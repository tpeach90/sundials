import { createApp } from 'vue'
import App from './App.vue'
import './assets/global.css'
import Vue3Tour from 'vue3-tour'
// import 'vue3-tour/dist/vue3-tour.css'
import "./assets/popper.css"; 

const app = createApp(App)

app.use(Vue3Tour)

app.mount('#app')