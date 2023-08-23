import "./App.css";
import React, { useEffect, useState } from "react";
import { ThemeProvider } from "theme-ui";
import * as Ably from "ably/promises";
import theme from "./theme";
import { API_URL, useIsMobileOrTablet } from "./utils";
import MapCanvas from "./canvas/MapCanvas";

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
        <MapCanvas />
      </div>
    </ThemeProvider>
  );
}

export default App;
