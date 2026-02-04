import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { FileViewer } from "./components/FileViewer";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/file/:id" element={<FileViewer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
