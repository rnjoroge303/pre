const express = require('express');
const path = require('path');
require('dotenv').config();

const mainRoutes = require('./routes/main');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', mainRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});