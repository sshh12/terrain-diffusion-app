import "./App.css";
import React, { useEffect, useState } from "react";
import { ThemeProvider } from "theme-ui";
import { Text } from "rebass";
import * as Ably from "ably/promises";
import theme from "./theme";
import CanvasDraw from "react-canvas-draw";
import { API_URL, useIsMobileOrTablet } from "./utils";

const genRandomID = () => {
  const vocab = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (var i = 0; i < 6; i++) {
    result += vocab.charAt(Math.floor(Math.random() * vocab.length));
  }
  return result;
};

function App() {
  const isTouch = useIsMobileOrTablet();
  let [ably, setAbly] = useState(null);
  console.log(ably, isTouch);
  useEffect(() => {
    const clientId = genRandomID();
    const ably = new Ably.Realtime.Promise({
      authUrl: `${API_URL}/api/token-request?clientId=${clientId}`,
    });
    setAbly(ably);
  }, []);
  return (
    <ThemeProvider theme={theme}>
      <div className="App">
        <Text p={2} fontWeight="bold">
          App
        </Text>
        <CanvasDraw lazyRadius={0} disabled={false} />
        <CanvasDraw lazyRadius={0} disabled={false} />
      </div>
    </ThemeProvider>
  );
}

export default App;
