import { Step } from "vue3-tour"

const tourSteps: Step[] = [
    {
        target: '#app',
        content: `Click and drag on the sundial to look around, and use the mouse wheel to adjust the zoom.
Zoom out to see the sun's position!`,
        params: {
            placement: 'bottom',
            enableScrolling: false,
        },
    },
    {
        target: '[data-v-walkthrough="status"]',
        content: `Use the sliders to change the <b>Time</b> and <b>Date</b>.
You can also click on the digital clock to set the time manually.`,
        params: {
            placement: 'auto',
            enableScrolling: false,
            highlight: true
        },
    },
    {
        target: '[data-v-walkthrough="map"]',
        content: `Sundials work differently depending on the location on Earth.
Set the location by clicking on the map, or by typing the <b>Latitude</b> and <b>Longitude</b>.`,
        params: {
            placement: 'right',
            enableScrolling: false,
            highlight: true,
        },
    },
    {
        target: '[data-v-walkthrough="time-zone"]',
        content: `The <b>Time Zone</b> is set automatically based on the longitude. Instead, to manually input the time zone, uncheck <b>Automatically set time zone</b> and type in the <b>Time Zone</b> box.
`,
        params: {
            placement: 'right',
            enableScrolling: false,
            highlight: true,
        },
    },
    {
        target: '[data-v-walkthrough="slant-and-rotation"]',
        content: `The <b>Slant</b> and <b>Rotation</b> of the sundial can be changed. 
E.g. to simulate a wall-mounted sundial, set the <b>Slant</b> to 90° and the <b>Rotation</b> to the direction the wall is facing.`,
        params: {
            placement: 'right',
            // enableScrolling: false,
            highlight: true
        },
    },
    {
        target: '[data-v-walkthrough="hour-lines"]',
        content: `Sundials often measure <b>Solar time</b>, where solar noon is the time at which the sun is highest in the sky.
However, you may want the sundial to measure an approximation of standard time, taking the longitude and time zone into account. To do this, select <b>Adjusted for time zone</b>. Note that depending on the time of year the reading can be inaccurate by up to 16 min 33 s due to the varying length of the solar day (see <a href="https://en.wikipedia.org/wiki/Equation_of_time" target="_blank">https://en.wikipedia.org/wiki/Equation_of_time</a>).`,
        params: {
            placement: 'right',
            // enableScrolling: false,
            highlight: true
        },
    },
]



export { tourSteps }