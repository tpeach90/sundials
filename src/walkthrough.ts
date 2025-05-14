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
        content: `Use the sliders to change the <strong>Time</strong> and <strong>Date</strong>.
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
Set the location by clicking on the map, or by typing the <strong>Latitude</strong> and <strong>Longitude</strong>.`,
        params: {
            placement: 'right',
            enableScrolling: false,
            highlight: true,
        },
    },
    {
        target: '[data-v-walkthrough="time-zone"]',
        content: `The <strong>Time Zone</strong> is set automatically based on the longitude. Instead, to manually input the time zone, uncheck <strong>Automatically set time zone</strong> and type in the <strong>Time Zone</strong> box.
`,
        params: {
            placement: 'right',
            enableScrolling: false,
            highlight: true,
        },
    },
    {
        target: '[data-v-walkthrough="sundial-type"]',
        content: `Choose between 2 types of sundial. <strong>Traditional sundial</strong> uses a <i>gnomon</i> to cast a shadow, and <strong>Point shadow trace</strong> uses a <i>nodus</i>, showing where the shadow of a single point falls throughout the day and year.`,
        params: {
            placement: 'right',
            // enableScrolling: false,
            highlight: true
        },
    },
    {
        target: '[data-v-walkthrough="slant-and-rotation"]',
        content: `The <strong>Slant</strong> and <strong>Rotation</strong> of the sundial can be changed. 
E.g. to simulate a wall-mounted sundial, set the <strong>Slant</strong> to 90° and the <strong>Rotation</strong> to the direction the wall is facing.<br>
Additionally, the <strong>Gnomon height</strong> (or Nodus height in Point shadow trace mode) adjusts the distance from the center of the shadow-casting object to the plate. The unit is arbitrary, because it's only the scale that matters.`,
        params: {
            placement: 'right',
            // enableScrolling: false,
            highlight: true
        },
    },
    {
        target: '[data-v-walkthrough="hour-lines"]',
        content: `Sundials often measure <strong>Solar time</strong>, where solar noon is the time at which the sun is highest in the sky.
However, you may want the sundial to measure an approximation of standard time, taking the longitude and time zone into account. To do this, select <strong>Adjusted for time zone and longitude</strong>. Note that depending on the time of year the reading can be inaccurate by up to 16 min 33 s due to the varying length of the solar day (see <a href="https://en.wikipedia.org/wiki/Equation_of_time" target="_blank">https://en.wikipedia.org/wiki/Equation_of_time</a>).`,
        params: {
            placement: 'right',
            // enableScrolling: false,
            highlight: true
        },
    },
]



export { tourSteps }