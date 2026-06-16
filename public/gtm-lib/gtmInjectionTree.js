// Tree node class representing each node in the tree
class TreeNode {
  constructor(url, tags) {
    this.url = url; // URL associated with the node
    this.tags = tags; // Possible injectors
    this.children = []; // Children nodes of this node
  }

  // Method to add a child node to the current node
  addChild(url, tags) {
    const childNode = new TreeNode(url, tags); // Create a new TreeNode
    this.children.push(childNode); // Add the new node to the children array
    return childNode; // Return the newly created node
  }

  // Method to display the tree structure starting from this node
  display(indent = 0) {
    const indentStr = ' '.repeat(indent * 2); // Create indentation string
    console.log(`${indentStr}${this.url}`); // Display the URL
    for (const child of this.children) {
      child.display(indent + 1); // Recursively display children nodes
    }
  }
}

// Initialize the tree with existing data
export function initTree(gtmUrl, nodeMap){
  const root = new TreeNode("Root", []); // Create the root node with URL "Root"
  const childNode = root.addChild(gtmUrl, ["GTM"]); // Add child nodes
  nodeMap[gtmUrl] = childNode; // Map the URL to the child node
  return root; // Return the root node of the populated tree
};

// Function to add a new request to the tree
export function addRequest(req, tags, nodeMap){
  const initiatorNode = nodeMap[req.initiator]; // Get the initiator node from the map
  if (initiatorNode) {
    const newNode = initiatorNode.addChild(req.url, tags); // Add a new child node for the request
    nodeMap[req.url] = newNode; // Map the URL to the newly created node
  }
};

// Function to display the entire tree starting from the root
export function displayTree(root){
  root.display(); // Call the display method on the root node
};

// Convert a URL pattern to a regular expression for matching
export function urlToRegex(url) {
  // Escape special characters except '*'
  const escapedPattern = url.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace '*' with '.*' for regex matching zero or more characters
  const regexPattern = escapedPattern.replace(/\*/g, '.*');
  // Returning the corresponding Regex
  return new RegExp(`${regexPattern}`); 
}

// Function to get possible injectors based on the injected script URL
export function getPossibleInjectors(injectedScript, scriptsMap){
  let possibleInjectors = new Set(); // Use a Set to store unique injectors
  if(injectedScript.includes("https://www.googletagmanager.com/gtm.js")){
    possibleInjectors.add("Zone"); // Add "Zone Tag" if GTM script is found
  } else {
    Object.keys(scriptsMap).forEach(url => {
      if(injectedScript.match(urlToRegex(url))){
        scriptsMap[url].forEach(tagName => possibleInjectors.add(tagName)); // Add tag names from the matched URL
      }
    });
  }
  return [...possibleInjectors]; // Return the injectors as an array
}

// Function to find the GTM initiator URL from captured URLs and scripts map
export function getGtmUrlFromInitiator(capturedUrls, scriptsMap){
  for (const capturedUrl in capturedUrls) {
      const initiator = capturedUrls[capturedUrl];
      if(initiator){
        for(const url of Object.keys(scriptsMap)){
          if(capturedUrl.match(urlToRegex(url))){
            return initiator; // Return the initiator URL if a match is found
          }
        }
      }
  }
  return null; // Return null if no match is found
}



