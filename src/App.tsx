import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { theme } from "./theme";
import Main from "./components/Main";
import '@mantine/dropzone/styles.css';


export default function App() {

  return (
    <MantineProvider theme={theme}>
      <Provider store={store}>
        <Main />
      </Provider>
    </MantineProvider>
  );
}
