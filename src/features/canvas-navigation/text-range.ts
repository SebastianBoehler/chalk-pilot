function textNodesWithin(root: HTMLElement) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

export function findExactRenderedTextRange(root: HTMLElement, text: string) {
  const nodes = textNodesWithin(root);
  const renderedText = nodes.map(({ data }) => data).join("");
  const start = renderedText.indexOf(text);
  if (start === -1) return null;

  const end = start + text.length;
  let offset = 0;
  let startNode: Text | null = null;
  let startOffset = 0;

  for (const node of nodes) {
    const nodeEnd = offset + node.data.length;
    if (!startNode && start >= offset && start <= nodeEnd) {
      startNode = node;
      startOffset = start - offset;
    }
    if (startNode && end >= offset && end <= nodeEnd) {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(node, end - offset);
      return range;
    }
    offset = nodeEnd;
  }

  return null;
}
