
const express = require('express')
const app = express()
const port = 3000

// Cette ligne indique le répertoire qui contient
// les fichiers statiques: html, css, js, images etc.
app.use(express.static('views'))

app.get('/', (req, res) => {
  res.render('index')
})

app.listen(port, () => {
  console.log(`Project at http://localhost:${port}`)
})
