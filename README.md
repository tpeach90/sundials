# sundials

Simulate a sundial at any time/position. Under active development, and incomplete. See [docs/spec.md](docs/spec.md) for a list of planned features.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Note

There is a bug in Cientos in the Line2 code. For a temporary fix, go to node_modules/@tresjs/cientos/dist/trescientos.js, line 15317, and add `, { immediate: true }` in the specified place.


], () => l(n, e)), ve([e.points, e.vertexColors], () => c(s, e.points, e.vertexColors)), ve(() => e.vertexColors, () => c(s, e.points, e.vertexColors)), ve(() => e.points, () => c(s, e.points, e.vertexColors)), ve([r.height, r.width], () => n.resolution = new ge(r.width.value, r.height.value)**, { immediate: true }**), ct(() => {
