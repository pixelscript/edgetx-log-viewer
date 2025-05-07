import "@mantine/core/styles.css";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { theme } from "./theme";
import Main from "./components/Main";
import ErrorModal from "./components/ErrorModal"; // Added
import '@mantine/dropzone/styles.css';


export default function App() {

  return (
    <>
      <ColorSchemeScript defaultColorScheme="auto" />
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Provider store={store}>
          <Main />
          <ErrorModal />
      </Provider>
      </MantineProvider>
    </>
  );
}
