jest.mock('../../config/cloudinary', () => ({
  cloudinary: { uploader: { destroy: jest.fn() } },
}));
jest.mock('../logger', () => ({ error: jest.fn() }));

const { cloudinary } = require('../../config/cloudinary');
const logger = require('../logger');
const { destroyCloudinaryAsset } = require('../cloudinaryCleanup');

describe('destroyCloudinaryAsset', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('elimina el recurso exitosamente sin registrar ningún error', async () => {
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

    await destroyCloudinaryAsset('triomphe/properties/abc123', {
      controller: 'propertyController',
      operation: 'deleteImage',
      resourceId: 42,
    });

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('triomphe/properties/abc123', {});
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('no llama a Cloudinary si no se recibe un publicId', async () => {
    await destroyCloudinaryAsset(null, { controller: 'usersController', operation: 'updateUser' });

    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('registra el error y no lo propaga cuando Cloudinary responde con error', async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('Invalid API Key'));

    await expect(
      destroyCloudinaryAsset('triomphe/properties/bad', {
        controller: 'propertyController',
        operation: 'deleteProperty',
        resourceId: 7,
        imageId: 99,
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error eliminando recurso de Cloudinary',
      expect.objectContaining({
        controller: 'propertyController',
        operation: 'deleteProperty',
        resourceId: 7,
        imageId: 99,
        publicId: 'triomphe/properties/bad',
        error: 'Invalid API Key',
      })
    );
  });

  test('registra el error cuando el recurso no existe en Cloudinary', async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('Resource not found'));

    await destroyCloudinaryAsset('triomphe/testimonials/missing', {
      controller: 'testimonialController',
      operation: 'deleteTestimonial',
      resourceId: 5,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error eliminando recurso de Cloudinary',
      expect.objectContaining({ error: 'Resource not found', publicId: 'triomphe/testimonials/missing' })
    );
  });

  test('registra el error en caso de timeout', async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('Request Timeout'));

    await destroyCloudinaryAsset('triomphe/documents/slow', {
      controller: 'documentController',
      operation: 'deleteDocument',
      resourceId: 3,
      documentId: 10,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error eliminando recurso de Cloudinary',
      expect.objectContaining({ error: 'Request Timeout' })
    );
  });

  test('registra el error de autenticación', async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('Unauthorized: invalid signature'));

    await destroyCloudinaryAsset('triomphe/avatars/user1', {
      controller: 'usersController',
      operation: 'permanentDeleteUser',
      resourceId: 1,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error eliminando recurso de Cloudinary',
      expect.objectContaining({ error: 'Unauthorized: invalid signature' })
    );
  });

  test('reenvía options adicionales (ej. resource_type raw para documentos)', async () => {
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

    await destroyCloudinaryAsset(
      'triomphe/documents/contract',
      { controller: 'documentController', operation: 'deleteDocument', resourceId: 8 },
      { resource_type: 'raw' }
    );

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('triomphe/documents/contract', {
      resource_type: 'raw',
    });
  });
});
