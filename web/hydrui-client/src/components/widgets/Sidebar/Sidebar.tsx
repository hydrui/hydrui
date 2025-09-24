import React from "react";

import FilePreview from "@/components/widgets/FilePreview/FilePreview";
import TagList from "@/components/widgets/TagList/TagList";

import "./index.css";

const Sidebar: React.FC = () => {
  return (
    <div className="sidebar-container">
      <TagList />
      <div className="sidebar-divider"></div>
      <FilePreview />
    </div>
  );
};

export default Sidebar;
