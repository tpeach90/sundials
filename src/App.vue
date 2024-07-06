<template>
   <SundialScene/>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import SundialScene from './components/SundialScene.vue';

export default defineComponent({
  name: 'App',
  components: {
    SundialScene,
  }
});
</script>

<style>
#app {
  font-family: sans-serif;
  color:white;
  /* font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px; */
}
</style>
