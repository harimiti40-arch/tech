const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;

// --------------------- BASE DE DONNÉES ---------------------
const db = new sqlite3.Database('./techsubs.db');

db.serialize(() => {
    // Table Users
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Table Courses
    db.run(`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        level TEXT,
        description TEXT,
        cover_icon TEXT
    )`);

    // Table Lessons
    db.run(`CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER,
        title TEXT,
        content TEXT,
        video_url TEXT,
        code_example TEXT,
        order_pos INTEGER
    )`);

    // Table Quiz
    db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER,
        question TEXT,
        option1 TEXT,
        option2 TEXT,
        option3 TEXT,
        option4 TEXT,
        correct_answer INTEGER,
        FOREIGN KEY(lesson_id) REFERENCES lessons(id)
    )`);

    // Table User Progress
    db.run(`CREATE TABLE IF NOT EXISTS user_progress (
        user_id INTEGER,
        lesson_id INTEGER,
        completed INTEGER DEFAULT 0,
        completed_at DATETIME,
        PRIMARY KEY (user_id, lesson_id)
    )`);

    // Insertion des cours et leçons
    const insertCourse = db.prepare(`INSERT OR IGNORE INTO courses (id, title, level, description, cover_icon) VALUES (?, ?, ?, ?, ?)`);
    insertCourse.run(1, 'Introduction à la cybersécurité', 'Débutant', 'Apprenez les bases de la sécurité informatique', '🛡️');
    insertCourse.run(2, 'Hacking Éthique', 'Avancé', 'Techniques de pentesting et sécurité offensive', '🐱‍💻');
    insertCourse.run(3, 'Linux pour hackers', 'Intermédiaire', 'Maîtrisez Kali Linux et les commandes essentielles', '🐧');
    insertCourse.finalize();

    // Leçons détaillées
    const insertLesson = db.prepare(`INSERT OR IGNORE INTO lessons (id, course_id, title, content, code_example, video_url, order_pos) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    
    // Cours 1 - Cybersécurité
    insertLesson.run(1, 1, 'Qu\'est-ce que la cybersécurité ?', 'La cybersécurité est la pratique de la protection des systèmes, réseaux et programmes contre les attaques numériques. Ces attaques visent généralement à accéder, modifier ou détruire des informations sensibles...', '```python\n# Exemple simple de chiffrement\ndef simple_cipher(text, shift):\n    result = ""\n    for char in text:\n        if char.isalpha():\n            start = ord('A') if char.isupper() else ord('a')\n            result += chr((ord(char) - start + shift) % 26 + start)\n        else:\n            result += char\n    return result\n```', 'https://www.youtube.com/embed/example1', 1);
    
    insertLesson.run(2, 1, 'Les différents types de menaces', 'Malware, Phishing, Ransomware, DDoS... Chaque menace a ses caractéristiques et ses méthodes de prévention.', '```bash\n# Simuler une connexion SSH sécurisée\nssh -i key.pem user@192.168.1.10\n# Utilisez toujours des clés SSH au lieu des mots de passe\n```', null, 2);
    
    // Cours 2 - Hacking Ethique
    insertLesson.run(3, 2, 'Introduction au pentesting', 'Le test d\'intrusion (pentest) est une simulation d\'attaque informatique réalisée avec l\'autorisation de l\'entreprise.', '```bash\n# Reconnaissance avec nmap (usage éducatif uniquement!)\nnmap -sV -p- 192.168.1.1\n# Sur votre propre réseau uniquement\n```', 'https://www.youtube.com/embed/example2', 1);
    
    insertLesson.run(4, 2, 'Scanning et énumération', 'Identifier les ports ouverts, les services actifs, et les vulnérabilités potentielles.', '```python\nimport socket\n# Scanner un port spécifique\nsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\nresult = sock.connect_ex((\'127.0.0.1\', 80))\nif result == 0:\n    print("Port 80 ouvert")\n```', null, 2);
    
    // Cours 3 - Linux
    insertLesson.run(5, 3, 'Commandes essentielles sous Linux', 'ls, cd, pwd, mkdir, rm, chmod, grep, awk... les bases pour naviguer dans le terminal.', '```bash\n# Liste des fichiers avec détails\nls -la\n\n# Trouver un mot dans un fichier\ngrep "error" /var/log/syslog\n\n# Changer les permissions\nchmod +x script.sh\n```', null, 1);
    
    insertLesson.run(6, 3, 'Gestion des processus et permissions', 'Comprendre les droits root, les processus système, et les fichiers de configuration.', '```bash\n# Afficher les processus\nps aux | grep ssh\n\n# Tuer un processus (SIGKILL)\nkill -9 PID\n```', null, 2);
    insertLesson.finalize();

    // Quiz questions
    const insertQuiz = db.prepare(`INSERT OR IGNORE INTO quiz_questions (id, lesson_id, question, option1, option2, option3, option4, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertQuiz.run(1, 1, 'Que signifie "phishing"?', 'Une technique de pêche', 'Une attaque qui vole des informations via de faux emails/sites', 'Un type de malware', 'Un firewall', 2);
    insertQuiz.run(2, 3, 'Dans le pentesting, qu\'est-ce que "Nmap"?', 'Un éditeur de code', 'Un scanner réseau', 'Un antivirus', 'Un serveur web', 2);
    insertQuiz.run(3, 5, 'Quelle commande Linux permet de lister les fichiers?', 'ls', 'cd', 'pwd', 'mkdir', 1);
    insertQuiz.finalize();
});

// --------------------- EXPRESS MIDDLEWARE ---------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'techsubs_super_secret_key_2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 jour
}));

// Middleware pour injecter l'utilisateur connecté
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// --------------------- ROUTES API ---------------------
// Inscription
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, [username, email, hashedPassword], function(err) {
            if (err) return res.status(400).json({ error: 'Utilisateur ou email existe déjà' });
            req.session.user = { id: this.lastID, username, email, points: 0 };
            res.json({ success: true, user: req.session.user });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Connexion
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        req.session.user = { id: user.id, username: user.username, email: user.email, points: user.points };
        res.json({ success: true, user: req.session.user });
    });
});

// Déconnexion
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Obtenir tous les cours
app.get('/api/courses', (req, res) => {
    db.all(`SELECT * FROM courses`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtenir un cours avec ses leçons
app.get('/api/courses/:id', (req, res) => {
    const courseId = req.params.id;
    db.get(`SELECT * FROM courses WHERE id = ?`, [courseId], (err, course) => {
        if (err || !course) return res.status(404).json({ error: 'Cours non trouvé' });
        db.all(`SELECT * FROM lessons WHERE course_id = ? ORDER BY order_pos`, [courseId], (err, lessons) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...course, lessons });
        });
    });
});

// Marquer une leçon comme terminée
app.post('/api/complete-lesson', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Connectez-vous d\'abord' });
    const { lesson_id } = req.body;
    const user_id = req.session.user.id;
    
    db.run(`INSERT OR REPLACE INTO user_progress (user_id, lesson_id, completed, completed_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)`, [user_id, lesson_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        // Ajouter des points
        db.run(`UPDATE users SET points = points + 20 WHERE id = ?`, [user_id]);
        db.get(`SELECT points FROM users WHERE id = ?`, [user_id], (err, user) => {
            if (user) req.session.user.points = user.points;
            res.json({ success: true, points: user?.points || 0 });
        });
    });
});

// Récupérer la progression de l'utilisateur
app.get('/api/progress', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    db.all(`SELECT lesson_id FROM user_progress WHERE user_id = ? AND completed = 1`, [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ completedLessons: rows.map(r => r.lesson_id) });
    });
});

// Obtenir les quiz d'une leçon
app.get('/api/quiz/:lessonId', (req, res) => {
    db.all(`SELECT * FROM quiz_questions WHERE lesson_id = ?`, [req.params.lessonId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Route pour l'interface HTML principale
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Serveur TECHSUBS démarré sur http://localhost:${PORT}`);
});
