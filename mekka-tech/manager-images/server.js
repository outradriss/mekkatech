const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsPromises = fs.promises; // Utilisation de fs.promises pour les opérations asynchrones
const path = require('path');
const sharp = require('sharp'); // Pour redimensionner les images

const app = express();
const PORT = 3000;

// Configuration pour Multer (upload d'images)
const upload = multer({ dest: 'uploads/' });

// Middleware pour servir les fichiers statiques
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, '..'))); // Permet de servir index.html depuis la racine
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Middleware pour traiter les requêtes JSON

// Liste des catégories et leurs dimensions
const categoriesDimensions = {
    'team': { width: 600, height: 700 },
    'clients': { width: 200, height: 200 },
    'slider': { width: 1920, height: 1080 },
    'Nos-projets': { width: 576, height: 1280 },
    'logos': null, // Pas de redimensionnement
};

// Route pour servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Route pour afficher la gestion des images
app.get('/add-images', (req, res) => {
    const categories = Object.keys(categoriesDimensions);
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <title>Gestion des images</title>
        </head>
        <body class="bg-light">
            <div class="container mt-5">
                <h1 class="text-center">Gestion des Images</h1>
                <div class="mt-4">
                    <h3 class="text-center">Liste des catégories</h3>
                    <ul class="list-group w-50 mx-auto">
                        ${categories
                            .map(
                                (cat) =>
                                    `<li class="list-group-item d-flex justify-content-between align-items-center">
                                        ${cat}
                                        <a href="/category?category=${cat}" class="btn btn-primary btn-sm">Gérer</a>
                                    </li>`
                            )
                            .join('')}
                    </ul>
                </div>
            </div>
        </body>
        </html>
    `);
});

// API pour récupérer les images d'une catégorie
app.get('/api/images/:category', (req, res) => {
    const { category } = req.params;
    const dirPath = path.join(__dirname, 'img', category);

    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ message: 'Catégorie introuvable' });
    }

    const images = fs.readdirSync(dirPath).map((file) => `/img/${category}/${file}`);
    res.json(images);
});

// Endpoint pour afficher une catégorie
app.get('/category', (req, res) => {
    const { category } = req.query;
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Charger dynamiquement les images
                fetch('/api/images/${category}')
                    .then(response => response.json())
                    .then(images => {
                        const imageList = document.getElementById('image-list');
                        images.forEach(img => {
                            const item = \`
                                <div class="col-md-3 text-center" id="\${img.split('/').pop()}">
                                    <div class="card mb-4">
                                        <img src="\${img}" class="card-img-top" style="height: 150px; object-fit: cover;">
                                        <div class="card-body">
                                            <button class="btn btn-warning btn-sm" onclick="openModifyModal('\${img}', '${category}')">Modifier</button>
                                            <button class="btn btn-danger btn-sm" onclick="deleteImage('\${img.split('/').pop()}', '${category}')">Supprimer</button>
                                        </div>
                                    </div>
                                </div>\`;
                            imageList.innerHTML += item;
                        });
                    });

                // Ouvrir le modal pour modifier une image
                function openModifyModal(image, category) {
                    const modal = new bootstrap.Modal(document.getElementById('modifyImageModal'));
                    document.getElementById('oldImage').value = image.split('/').pop();
                    document.getElementById('category').value = category;
                    modal.show();
                }

                // Supprimer une image
                function deleteImage(image, category) {
                    if (confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
                        fetch('/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ category, image })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.message) {
                                document.getElementById(image).remove();
                                alert('Image supprimée avec succès.');
                            } else {
                                alert('Erreur lors de la suppression.');
                            }
                        })
                        .catch(err => console.error('Erreur lors de la suppression :', err));
                    }
                }
            </script>
            <title>Gestion des images - ${category}</title>
        </head>
        <body class="bg-light">
            <div class="container mt-5">
                <h1 class="text-center">Images dans la catégorie : ${category}</h1>
                <button class="btn btn-success my-3" data-bs-toggle="modal" data-bs-target="#addImageModal">Ajouter une image</button>
                <div class="row" id="image-list"></div>

                <!-- Modal pour ajouter une image -->
                <div class="modal fade" id="addImageModal" tabindex="-1" aria-labelledby="addImageModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="addImageModalLabel">Ajouter une image</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <form action="/upload" method="POST" enctype="multipart/form-data">
                                    <input type="hidden" name="category" value="${category}">
                                    <div class="mb-3">
                                        <label for="image" class="form-label">Sélectionner une image</label>
                                        <input type="file" class="form-control" name="image" id="image" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary">Uploader</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal pour modifier une image -->
                <div class="modal fade" id="modifyImageModal" tabindex="-1" aria-labelledby="modifyImageModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="modifyImageModalLabel">Modifier une image</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <form action="/modify" method="POST" enctype="multipart/form-data">
                                    <input type="hidden" name="category" id="category">
                                    <input type="hidden" name="oldImage" id="oldImage">
                                    <div class="mb-3">
                                        <label for="newImage" class="form-label">Sélectionner une nouvelle image</label>
                                        <input type="file" class="form-control" name="newImage" id="newImage" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary">Modifier</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});


// Endpoint pour uploader une image
app.post('/upload', upload.single('image'), async (req, res) => {
    const { category } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).send('Erreur : Aucun fichier uploadé');
    }

    const destPath = path.join(__dirname, 'img', category, file.originalname);
    const dimensions = categoriesDimensions[category];

    try {
        if (dimensions) {
            await sharp(file.path)
                .resize(dimensions.width, dimensions.height, { fit: 'cover' })
                .toFile(destPath);
        } else {
            fs.renameSync(file.path, destPath);
        }

        if (fs.existsSync(file.path)) {
            try {
                await fsPromises.unlink(file.path);
            } catch (err) {
                console.error('Erreur lors de la suppression du fichier temporaire :', err);
            }
        }

        res.redirect(`/category?category=${category}`);
    } catch (err) {
        console.error('Erreur lors du traitement de l\'image :', err);
        res.status(500).send('Erreur lors du traitement de l\'image');
    }
});

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
