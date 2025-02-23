/// <reference types="@figma/plugin-typings" />

// Configuration
const CONFIG = {
  defaultCornerRadius: 4,
  defaultOpacity: 0.2,
  minOpacity: 0.1,
  maxOpacity: 0.4,
};

// Helper function to get text color
async function getTextColor(textNode: TextNode): Promise<Paint[]> {
  await figma.loadFontAsync(textNode.fontName as FontName);

  // If the text has styled characters, use the first non-null fill
  if (textNode.getStyledTextSegments(["fills"]).length > 1) {
    const segments = textNode.getStyledTextSegments(["fills"]);
    for (const segment of segments) {
      if (segment.fills && Array.isArray(segment.fills) && segment.fills.length > 0) {
        return segment.fills as Paint[];
      }
    }
  }

  // Return the text's fills or a default black fill
  return Array.isArray(textNode.fills) && textNode.fills.length > 0 ? textNode.fills : [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
}

// Helper function to calculate opacity based on text properties
function calculateOpacity(textNode: TextNode): number {
  const baseOpacity = CONFIG.defaultOpacity;
  const textLength = textNode.characters.length;
  const fontSize = typeof textNode.fontSize === "number" ? textNode.fontSize : 14;

  // Adjust opacity based on text properties
  let opacity = baseOpacity;
  opacity *= Math.min(1, Math.max(0.5, fontSize / 24)); // Larger text = slightly more opaque
  opacity *= Math.min(1, Math.max(0.7, textLength / 50)); // Longer text = slightly more opaque

  return Math.min(Math.max(opacity, CONFIG.minOpacity), CONFIG.maxOpacity);
}

// Helper function to safely get children of a node
function getChildren(node: SceneNode): SceneNode[] {
  if ("children" in node) {
    return [...node.children];
  }
  return [];
}

// Process a node and all its children
async function processNode(node: SceneNode) {
  try {
    // Skip if node is no longer valid
    if (!node.parent) return;

    // Handle instance
    if (node.type === "INSTANCE") {
      const parent = node.parent;
      const index = parent.children.indexOf(node);

      // Detach the instance
      await node.detachInstance();

      // Get the new frame that replaced the instance
      const detachedFrame = parent.children[index];
      if (detachedFrame) {
        // Process the detached frame's children
        const children = getChildren(detachedFrame);
        for (const child of children) {
          await processNode(child);
        }
      }
      return;
    }

    // Convert text node
    if (node.type === "TEXT") {
      const ghostRect = figma.createRectangle();
      ghostRect.name = `Ghost_${node.name}`;
      ghostRect.resize(node.width, node.height);

      // Get text styling
      const textColor = await getTextColor(node);
      ghostRect.fills = textColor;
      ghostRect.opacity = calculateOpacity(node);

      // Position and style
      ghostRect.x = node.x;
      ghostRect.y = node.y;
      ghostRect.cornerRadius = CONFIG.defaultCornerRadius;

      // Maintain hierarchy
      if (node.parent) {
        const index = node.parent.children.indexOf(node);
        node.parent.insertChild(index, ghostRect);
      }

      // Remove original text node
      node.remove();
      return;
    }

    // Process children
    const children = getChildren(node);
    for (const child of children) {
      await processNode(child);
    }
  } catch (error) {
    console.error(`Error processing node "${node.name}":`, error);
  }
}

// Main execution
(async () => {
  try {
    const { selection } = figma.currentPage;

    if (selection.length === 0) {
      figma.notify("Please select at least one frame or element");
      figma.closePlugin();
      return;
    }

    // Process each selected node
    for (const node of selection) {
      await processNode(node);
    }

    figma.notify("Successfully converted text to ghost frames! 👻");
  } catch (error) {
    console.error("Plugin error:", error);
    figma.notify("An error occurred while processing");
  } finally {
    figma.closePlugin();
  }
})();
