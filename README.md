# EdgeTX Log Viewer

A web application for visualizing EdgeTX flight log data.

![Screenshot of the UI](screenshot.png)

## Features

*   Can import multiple EdgeTX / OpenTX `.csv` log files.
*   Each log is sortable by model, date, duration, max altitude and max distance
*   Visualize flight paths on a 3D globe.
*   Line color can show flight mode or any numerical log value.
*   Playback flight with scrubbable timeline.
*   Logs can be exported to GPX or KML format along with an altitude offset.

## Enable telemetry logs

How to enable telemetry logs on your EdgeTX / OpenTX device

* Blog - [https://oscarliang.com/log-telemetry](https://oscarliang.com/log-telemetry)
* Video - [EdgeTX Setting Up Telemetry Data Logging to your Radio](https://youtu.be/SsbnONkErbc?t=68)

## Building locally

### Prerequisites

*   Node.js
*   Yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd edgetx-log-viewer
    ```
2.  Install dependencies using Yarn:
    ```bash
    yarn install
    ```

### Running the Development Server

To start the application in development mode:

```bash
yarn dev
```

This will start the Vite development server, typically available at `http://localhost:5173`.

### Building for Production

To create a production build:

```bash
yarn build
```

The optimized build files will be located in the `dist` directory.

### Previewing the Production Build

To preview the production build locally:

```bash
yarn preview
```

## License

[MIT License](./LICENSE)

### Assets not covered by same licence
- Small Airplane by Vojtěch Balák [CC-BY](https://creativecommons.org/licenses/by/3.0/) via [Poly Pizza](https://poly.pizza/m/7cvx6ex-xfL)
- Jet by jeremy [CC-BY](https://creativecommons.org/licenses/by/3.0/) via [Poly Pizza](https://poly.pizza/m/6fyLMORhgGK)
- Drone by NateGazzard [CC-BY](https://creativecommons.org/licenses/by/3.0/) via [Poly Pizza](https://poly.pizza/m/DNbUoMtG3H)