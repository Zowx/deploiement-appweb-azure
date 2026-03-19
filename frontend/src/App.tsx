import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { FileViewer } from "./components/FileViewer";
import { LogsPage } from "./pages/LogsPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/file/:id" element={<FileViewer />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
