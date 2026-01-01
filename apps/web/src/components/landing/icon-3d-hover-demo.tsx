// This is file with demos of your component
// Each export is one usecase for your component

import { IconHover3D } from "@v1/ui/icon-3d-hover";

const DemoOne = () => {
  return <IconHover3D />;
};

const DemoTwo = () => {
  return (
    <IconHover3D
      heading="Museum Collections"
      text="Explore curated collections from museums around the world with detailed cataloging and rich metadata."
    />
  );
};

const DemoThree = () => {
  return (
    <IconHover3D
      heading="Digital Archive"
      text="Access comprehensive digital archives with powerful search capabilities and preservation standards."
    />
  );
};

export { DemoOne, DemoTwo, DemoThree };
