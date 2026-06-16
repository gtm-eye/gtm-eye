import Tree from "react-d3-tree";
import { useCenteredTree } from "./helpers";


const containerStyles = {
  width: "100vw",
  height: "100vh"
};

const renderRectSvgNode = ({ nodeDatum, toggleNode }) => (
  <g>
    <circle r="10" onClick={toggleNode} />
    <foreignObject width="300" height="150" x="20" y="-10">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          width: "300px", // Fixed width for the container
          overflowX: "auto", // Enable horizontal scrolling
          backgroundColor: "#f8f9fa",
          padding: "10px",
          borderRadius: "5px"
        }}
      >
        {nodeDatum.tags && nodeDatum.tags.map((tag, index) => (
          <div
            key={index}
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              color: "#333",
              marginBottom: "5px"
            }}
          >
            {tag}
          </div>
        ))}
        <pre
          style={{
            margin: 0, // Remove default margin
            whiteSpace: "nowrap", // Prevent text wrapping
            overflowX: "auto" // Enable horizontal scrolling within the pre
          }}
        >
          {nodeDatum.url}
        </pre>
      </div>
    </foreignObject> 
  </g>
);



export default function InjectionTree({tree}) {
  const [translate, containerRef] = useCenteredTree();

  return (
    <div style={containerStyles} ref={containerRef}>
      <Tree
        data={tree}
        translate={translate}
        renderCustomNodeElement={renderRectSvgNode}
        orientation="horizontal"
        nodeSize={{ x: 400, y: 150 }}
      />
    </div>
  );
}
