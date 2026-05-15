# 🏦 Triomphe Remates

> Sistema web de remates bancarios — Triomphe Bienes Raíces

Un platform moderno para gestionar subastas de propiedades bancarias con una interfaz intuitiva y backend robusto.

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Tech Stack](#tech-stack)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [API Documentation](#api-documentation)
- [Scripts Disponibles](#scripts-disponibles)
- [Contribución](#contribución)
- [Licencia](#licencia)

---

## ✨ Características

- 🔐 **Autenticación segura** con JWT y bcrypt
- 💳 **Gestión de propiedades** para remates bancarios
- 📧 **Notificaciones por email** con Nodemailer
- 🔄 **Sincronización en tiempo real** con React Query
- 📱 **Interfaz responsive** con React + Vite
- 📚 **Documentación API** con Swagger
- 🗂️ **ORM moderno** con Sequelize
- 📦 **Carga de archivos** con Multer

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express 5.2
- **Base de datos**: MySQL con Sequelize ORM
- **Autenticación**: JWT + bcryptjs
- **Documentación**: Swagger (swagger-jsdoc)
- **Email**: Nodemailer
- **Variables de entorno**: dotenv

### Frontend
- **Framework**: React 19
- **Build tool**: Vite
- **Router**: React Router DOM v7
- **HTTP Client**: Axios
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query v5
- **Linting**: ESLint

---

## 📦 Requisitos Previos

Asegúrate de tener instalado:
- **Node.js** >= 18.x
- **npm** >= 9.x o **yarn** >= 3.x
- **MySQL** >= 8.0
- **Git**

### Verificar instalación:
```bash
node --version
npm --version
mysql --version
```

---

## 🚀 Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/Ericolink/triomphe-remates.git
cd triomphe-remates
```

### 2. Instalar dependencias del servidor
```bash
cd server
npm install
```

### 3. Instalar dependencias del cliente
```bash
cd ../client
npm install
```

---

## ⚙️ Configuración

### Backend (.env)

Crear archivo `server/.env` con las siguientes variables:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=triomphe_remates

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d

# Email (Nodemailer)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Server
PORT=5000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)

Crear archivo `client/.env.local` con:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🎯 Uso

### Desarrollo - Ambos servicios

#### Opción 1: Terminales separadas

**Terminal 1 - Servidor:**
```bash
cd server
npm run dev
```
El servidor estará disponible en `http://localhost:5000`

**Terminal 2 - Cliente:**
```bash
cd client
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`

#### Opción 2: Usar concurrently (recomendado)

En la raíz del proyecto:
```bash
npm install -D concurrently
```

Agregar a `package.json` raíz:
```json
{
  "scripts": {
    "dev": "concurrently \"cd server && npm run dev\" \"cd client && npm run dev\""
  }
}
```

Luego ejecutar:
```bash
npm run dev
```

### Producción

**Build del cliente:**
```bash
cd client
npm run build
```

**Iniciar servidor:**
```bash
cd server
npm start
```

---

## 📁 Estructura del Proyecto

```
triomphe-remates/
├── server/                    # Backend Express
│   ├── config/               # Configuración de BD y auth
│   ├── controllers/          # Lógica de negocio
│   ├── routes/               # Definición de rutas
│   ├── models/               # Modelos Sequelize
│   ├── middleware/           # Middlewares (auth, validación)
│   ├── utils/                # Utilidades
│   ├── uploads/              # Archivos cargados
│   ├── server.js             # Archivo principal
│   ├── .env.example          # Variables de ejemplo
│   └── package.json
│
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   ├── pages/            # Páginas principales
│   │   ├── services/         # Llamadas a API
│   │   ├── store/            # Estado global (Zustand)
│   │   ├── hooks/            # Custom hooks
│   │   ├── styles/           # Estilos CSS
│   │   ├── App.jsx           # Componente principal
│   │   └── main.jsx          # Punto de entrada
│   ├── public/               # Archivos estáticos
│   ├── .env.local.example    # Variables de ejemplo
│   ├── vite.config.js        # Configuración Vite
│   ├── eslint.config.js      # Configuración ESLint
│   └── package.json
│
├── .gitignore                # Archivos a ignorar
├── README.md                 # Este archivo
└── package.json              # (Opcional) Root package.json
```

---

## 📚 API Documentation

Una vez que el servidor esté corriendo, accede a la documentación interactiva de Swagger:

```
http://localhost:5000/api/docs
```

---

## 🔧 Scripts Disponibles

### Servidor

```bash
npm run dev       # Desarrollo con nodemon
npm start         # Producción
npm test          # Ejecutar tests (próximamente)
```

### Cliente

```bash
npm run dev       # Servidor de desarrollo Vite
npm run build     # Build optimizado para producción
npm run preview   # Preview del build
npm run lint      # Ejecutar ESLint
```

---

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. **Fork** el repositorio
2. **Crea una rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre un Pull Request**

### Directrices de Código

- Mantener consistencia con ESLint
- Escribir commits descriptivos
- Agregar tests para nuevas funcionalidades
- Actualizar documentación si es necesario

---

## 🐛 Reporte de Bugs

Si encuentras un bug, por favor [abre un issue](https://github.com/Ericolink/triomphe-remates/issues) con:

- Descripción clara del problema
- Pasos para reproducirlo
- Comportamiento esperado vs actual
- Versión de Node.js y navegador (si aplica)

---

## 📝 Licencia

Este proyecto es de uso privado. Todos los derechos reservados © 2026 Triomphe Bienes Raíces.

---

## 📧 Contacto

Para preguntas o soporte contacta a:
- **Email**: ericmunoz441@gmail.com
- **GitHub**: [@Ericolink](https://github.com/Ericolink)

---

## 🎯 Roadmap

- [ ] Autenticación con roles y permisos
- [ ] Panel de administración
- [ ] Sistema de notificaciones en tiempo real
- [ ] Tests unitarios e integración
- [ ] CI/CD con GitHub Actions
- [ ] Deployment automático
- [ ] TypeScript migration
- [ ] Caché con Redis

---

**¡Happy coding! 🚀**
