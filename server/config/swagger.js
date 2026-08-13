const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Triomphe Remates Bancarios API',
      version: '1.0.0',
      description: 'API REST para el sistema de remates bancarios de Triomphe Bienes Raíces',
      contact: {
        name: 'Triomphe Bienes Raíces',
        email: 'contacto@triomphe.com',
      },
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Desarrollo' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          description: 'Representación de usuario devuelta por la API (sin password) — ver safeUser() en userService.js',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Juana Pérez' },
            email: { type: 'string', format: 'email', example: 'juana@triomphe.com' },
            role: {
              type: 'string',
              enum: ['admin', 'coordinador_ventas', 'asesor_ventas', 'asistente_administrativo'],
              example: 'asistente_administrativo',
            },
            isActive: { type: 'boolean', example: true },
            profilePhoto: { type: 'string', nullable: true, example: 'https://res.cloudinary.com/.../avatars/xyz.jpg' },
            lastLogin: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensaje de error' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
