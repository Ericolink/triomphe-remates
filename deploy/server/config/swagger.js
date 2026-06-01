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
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
