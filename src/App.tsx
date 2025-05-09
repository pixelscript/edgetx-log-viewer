import "@mantine/core/styles.css";
import '@mantine/dropzone/styles.css';
import "./global.css";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { theme } from "./theme";
import Main from "./components/Main";
import ErrorModal from "./components/ErrorModal";
import { PlaybackProvider } from "./contexts/PlaybackContext";

export default function App() {

  return (
    <>
      <ColorSchemeScript defaultColorScheme="auto" />
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Provider store={store}>
          <PlaybackProvider>
            <Main />
          </PlaybackProvider>
          <ErrorModal />
      </Provider>
      </MantineProvider>
    </>
  );
}
