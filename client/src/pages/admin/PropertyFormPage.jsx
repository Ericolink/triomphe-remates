import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Star, ArrowLeft, Lock, History, FileText, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPropertyById, createProperty, updateProperty,
  uploadImages, deleteImage, setCoverImage, reorderImages, getStatusHistory,
  getDocuments, uploadDocument, deleteDocument,
} from '../../services/propertyService';
import Spinner from '../../components/ui/Spinner';
import { safeBlobUrl } from '../../utils/sanitize';
import { buildImageUrl } from '../../utils/images';

const FIELDS = [
  { key: 'title', label: 'Título *', type: 'text', col: 2 },
  { key: 'price', label: 'Precio', type: 'price', col: 1 },
  { key: 'city', label: 'Ciudad *', type: 'select', col: 1, options: [{ value: 'juarez', label: 'Cd. Juárez' }, { value: 'chihuahua', label: 'Chihuahua' }, { value: 'queretaro', label: 'Querétaro' }] },
  { key: 'type', label: 'Tipo *', type: 'select', col: 1, options: [{ value: 'casa', label: 'Casa' }, { value: 'departamento', label: 'Departamento' }, { value: 'terreno', label: 'Terreno' }, { value: 'local', label: 'Local' }, { value: 'bodega', label: 'Bodega' }] },
  { key: 'status', label: 'Estatus', type: 'select', col: 1, options: [{ value: 'disponible', label: 'Disponible' }, { value: 'apartado', label: 'Apartado' }, { value: 'vendido', label: 'Vendido' }] },
  { key: 'terrainMeters', label: 'M² Terreno', type: 'number', col: 1 },
  { key: 'constructionMeters', label: 'M² Construcción', type: 'number', col: 1 },
  { key: 'bedrooms', label: 'Recámaras', type: 'number', col: 1 },
  { key: 'bathrooms', label: 'Baños', type: 'number', col: 1 },
  { key: 'auctionDate', label: 'Fecha del remate', type: 'date', col: 1 },
  { key: 'acquisitionStage', label: 'Etapa de adquisición', type: 'select', col: 1, options: [{ value: 'sin_proceso', label: 'Sin proceso' }, { value: 'documentacion', label: 'Documentación' }, { value: 'avaluo', label: 'Avalúo' }, { value: 'negociacion', label: 'Negociación' }, { value: 'firma', label: 'Firma' }, { value: 'entrega', label: 'Entrega' }] },
  { key: 'address', label: 'Dirección', type: 'text', col: 2 },
  { key: 'description', label: 'Descripción', type: 'textarea', col: 2 },
];

const CITY_CODE_PREFIX = { juarez: 'JRCH-', chihuahua: 'CHCH-', queretaro: 'QRQR-' };

const emptyForm = {
  title: '', price: '', pricePending: false, city: 'juarez', type: 'casa', status: 'disponible',
  squareMeters: '', terrainMeters: '', constructionMeters: '',
  bedrooms: '', bathrooms: '', address: '', description: '', isFeatured: false, internalNotes: '',
  auctionDate: '', acquisitionStage: 'sin_proceso',
  code: CITY_CODE_PREFIX.juarez, noCode: false,
};

const propertyToForm = (p) => ({
  title: p.title || '', price: p.price ?? '', pricePending: p.price === null || p.price === undefined,
  city: p.city || 'juarez', type: p.type || 'casa', status: p.status || 'disponible',
  squareMeters: p.squareMeters || '', terrainMeters: p.terrainMeters || '',
  constructionMeters: p.constructionMeters || '', bedrooms: p.bedrooms || '',
  bathrooms: p.bathrooms || '', address: p.address || '',
  description: p.description || '', isFeatured: p.isFeatured || false,
  internalNotes: p.internalNotes || '',
  auctionDate: p.auctionDate ? new Date(p.auctionDate).toISOString().split('T')[0] : '',
  acquisitionStage: p.acquisitionStage || 'sin_proceso',
  code: p.code || '', noCode: !p.code,
});

const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };
const statusDot = { disponible: 'bg-green-500', apartado: 'bg-yellow-500', vendido: 'bg-red-500' };

const inputClass ='w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

function ImageThumb({ img, index, isDragging, onSetCover, onDelete, onDragStart, onDragOver, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDragEnd={onDragEnd}
      className={`relative group select-none cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-40' : ''}`}>
      <img src={buildImageUrl(img.url, 240)} alt="Imagen de propiedad" loading="lazy" decoding="async" draggable={false}
        className={`w-full aspect-square object-cover rounded-xl border-2 transition-colors pointer-events-none select-none ${img.isCover ? 'border-yellow-400' : 'border-transparent'}`} />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1">
        <button type="button" draggable onDragStart={(e) => e.preventDefault()} onClick={onSetCover}
          className="p-1 bg-yellow-400 rounded-lg" title="Hacer portada">
          <Star size={16} className="text-blue-900" />
        </button>
        <button type="button" draggable onDragStart={(e) => e.preventDefault()} onClick={onDelete}
          className="p-1 bg-red-500 rounded-lg" title="Eliminar">
          <X size={16} className="text-white" />
        </button>
      </div>
      {img.isCover && (
        <span className="absolute top-1 left-1 bg-yellow-400 text-blue-900 text-xs px-1.5 py-0.5 rounded-md font-medium">
          Portada
        </span>
      )}
    </div>
  );
}

export default function PropertyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [newFiles, setNewFiles] = useState([]);
  const [imageOrder, setImageOrder] = useState([]);
  const [loadedImagesKey, setLoadedImagesKey] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const orderRef = useRef([]);

  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => getPropertyById(id),
    enabled: isEdit,
  });

  const { data: historyData } = useQuery({
    queryKey: ['property-status-history', id],
    queryFn: () => getStatusHistory(id),
    enabled: isEdit,
  });
  const statusHistory = historyData?.data ?? [];

  const { data: documentsData } = useQuery({
    queryKey: ['property-documents', id],
    queryFn: () => getDocuments(id),
    enabled: isEdit,
  });
  const documents = documentsData ?? [];

  const serverForm = useMemo(
    () => (data?.data ? propertyToForm(data.data) : null),
    [data]
  );

  const [form, setForm] = useState(emptyForm);
  const [formLoaded, setFormLoaded] = useState(false);

  if (serverForm && !formLoaded) {
    setFormLoaded(true);
    setForm(serverForm);
  }

  const previews = useMemo(
    () => newFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newFiles]
  );


  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      let property;
      if (isEdit) {
        property = await updateProperty(id, formData);
      } else {
        property = await createProperty(formData);
      }
      if (newFiles.length > 0) {
        const propId = isEdit ? id : property.data.id;
        await uploadImages(propId, newFiles);
      }
      return property;
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Propiedad actualizada' : 'Propiedad creada');
      queryClient.invalidateQueries(['admin-properties']);
      navigate('/admin/propiedades');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const deleteImgMutation = useMutation({
    mutationFn: ({ imgId }) => deleteImage(id, imgId),
    onSuccess: () => {
      toast.success('Imagen eliminada');
      queryClient.invalidateQueries(['property', id]);
    },
  });

  const coverMutation = useMutation({
    mutationFn: (imgId) => setCoverImage(id, imgId),
    onSuccess: () => {
      toast.success('Portada actualizada');
      queryClient.invalidateQueries(['property', id]);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (imageIds) => reorderImages(id, imageIds),
    onSuccess: () => {
      queryClient.invalidateQueries(['property', id]);
    },
    onError: () => toast.error('Error al actualizar el orden'),
  });

  const uploadDocMutation = useMutation({
    mutationFn: (file) => uploadDocument(id, file, file.name),
    onSuccess: () => {
      toast.success('Documento subido');
      queryClient.invalidateQueries(['property-documents', id]);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al subir documento'),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId) => deleteDocument(id, docId),
    onSuccess: () => {
      toast.success('Documento eliminado');
      queryClient.invalidateQueries(['property-documents', id]);
    },
  });

  const handleDocFile = (e) => {
    const file = e.target.files[0];
    if (file) uploadDocMutation.mutate(file);
    e.target.value = '';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles((f) => [...f, ...files]);
  };

  const removeNewFile = (i) => {
    setNewFiles((f) => f.filter((_, idx) => idx !== i));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.city || !form.type) {
      return toast.error('Título, ciudad y tipo son requeridos');
    }
    const { pricePending, noCode, ...rest } = form;
    saveMutation.mutate({ ...rest, price: pricePending ? null : form.price, code: noCode ? '' : form.code });
  };

  const existingImages = data?.data?.images || [];
  const imagesKey = existingImages.map((img) => `${img.id}:${img.isCover}`).join(',');
  if (existingImages.length > 0 && imagesKey !== loadedImagesKey) {
    setLoadedImagesKey(imagesKey);
    setImageOrder(existingImages);
  }

  useEffect(() => {
    orderRef.current = imageOrder;
  }, [imageOrder]);

  const handleDragStart = (index) => setDragIndex(index);

  const handleDragOver = (index) => {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...orderRef.current];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    orderRef.current = next;
    setImageOrder(next);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    reorderMutation.mutate(orderRef.current.map((img) => img.id));
  };

  if (isEdit && isLoading) return <Spinner size="lg" className="py-20" />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-xl transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {isEdit ? 'Editar propiedad' : 'Nueva propiedad'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {isEdit ? 'Modifica los datos de la propiedad' : 'Completa los datos para agregar una propiedad'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Información general</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map(({ key, label, type, col, options }) => (
              <div key={key} className={col === 2 ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                {type === 'price' ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Ej: 1500000"
                      value={form.pricePending ? '' : (form.price ?? '')}
                      disabled={form.pricePending}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                    />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.pricePending}
                        onChange={(e) => setForm((f) => ({ ...f, pricePending: e.target.checked, price: e.target.checked ? '' : f.price }))}
                        className="w-4 h-4 rounded accent-blue-900"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Precio pendiente — se mostrará como <span className="font-semibold text-yellow-500">PENDIENTE</span>
                      </span>
                    </label>
                  </div>
                ) : type === 'textarea' ? (
                  <textarea value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={3}
                    className={`${inputClass} resize-none`} />
                ) : type === 'select' ? (
                  <select value={form[key]}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (key === 'city') {
                        setForm((f) => {
                          const next = { ...f, city: value };
                          if (!f.noCode && (f.code === '' || f.code === CITY_CODE_PREFIX[f.city])) {
                            next.code = CITY_CODE_PREFIX[value] || '';
                          }
                          return next;
                        });
                      } else {
                        setForm((f) => ({ ...f, [key]: value }));
                      }
                    }}
                    className={inputClass}>
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={type} value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className={inputClass} />
                )}
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Código de propiedad</label>
              <input type="text" value={form.code} disabled={form.noCode}
                placeholder={`Ej: ${CITY_CODE_PREFIX[form.city] || ''}0164`}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`} />
              <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                <input type="checkbox" checked={form.noCode}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    noCode: e.target.checked,
                    code: e.target.checked ? '' : (f.code || CITY_CODE_PREFIX[f.city] || ''),
                  }))}
                  className="w-4 h-4 rounded accent-blue-900" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Sin código asignado
                </span>
              </label>
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <input type="checkbox" id="featured" checked={form.isFeatured}
                onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                className="w-4 h-4 rounded accent-blue-900" />
              <label htmlFor="featured" className="text-sm text-gray-700 dark:text-gray-300">
                Destacar en el sitio público
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
            <Lock size={15} className="text-gray-400" /> Notas internas
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Privadas — solo visibles para administradores y editores. No aparecen en el sitio público.
          </p>
          <textarea value={form.internalNotes}
            onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
            rows={4} placeholder="Ej: contacto del banco, precio mínimo aceptable, observaciones legales..."
            className={`${inputClass} resize-none`} />
        </div>

        {isEdit && statusHistory.length > 0 && (
          <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <History size={15} className="text-gray-400" /> Historial de cambios
            </h2>
            <div className="space-y-3">
              {statusHistory.map((h) => (
                <div key={h.id} className="flex items-center gap-3 text-sm">
                  {h.changeType === 'price' ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-yellow-400" />
                      <span className="text-gray-600 dark:text-gray-300">
                        Precio:{' '}
                        {h.fromPrice !== null
                          ? <span className="text-gray-400 line-through">${Number(h.fromPrice).toLocaleString('es-MX')}</span>
                          : <span className="text-gray-400">PENDIENTE</span>
                        }
                        {' → '}
                        {h.toPrice !== null
                          ? <span className="font-medium text-gray-800 dark:text-gray-100">${Number(h.toPrice).toLocaleString('es-MX')}</span>
                          : <span className="font-medium text-yellow-500">PENDIENTE</span>
                        }
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot[h.toStatus]}`} />
                      <span className="text-gray-600 dark:text-gray-300">
                        {h.fromStatus ? (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">{statusLabel[h.fromStatus]}</span>
                            {' → '}
                            <span className="font-medium text-gray-800 dark:text-gray-100">{statusLabel[h.toStatus]}</span>
                          </>
                        ) : (
                          <>Publicada como <span className="font-medium text-gray-800 dark:text-gray-100">{statusLabel[h.toStatus]}</span></>
                        )}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {new Date(h.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {h.userName ? ` · ${h.userName}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isEdit && existingImages.length > 0 && (
          <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Imágenes actuales</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Arrastra las imágenes para cambiar el orden en que aparecen en la galería.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {imageOrder.map((img, index) => (
                <ImageThumb key={img.id} img={img} index={index}
                  isDragging={dragIndex === index}
                  onSetCover={() => coverMutation.mutate(img.id)}
                  onDelete={() => deleteImgMutation.mutate({ imgId: img.id })}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd} />
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">
            {isEdit ? 'Agregar más imágenes' : 'Imágenes'}
          </h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-[#2e3650] rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
            <Upload size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Haz clic o arrastra imágenes aquí</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG, PNG o WEBP · Máx. 5MB por imagen</p>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp"
              onChange={handleFiles} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
              {previews.map(({ url }, i) => (
                <div key={url} className="relative group">
                  <img src={safeBlobUrl(url)} alt="Vista previa"
                    className="w-full aspect-square object-cover rounded-xl border border-gray-200" />
                  <button type="button" onClick={() => removeNewFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {isEdit && (
          <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <FileText size={15} className="text-gray-400" /> Documentos
            </h2>

            {documents.length > 0 && (
              <div className="space-y-2 mb-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 bg-gray-50 dark:bg-[#1a1f2e] rounded-xl px-4 py-2.5">
                    <FileText size={16} className="text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{doc.name}</span>
                    {doc.size && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatFileSize(doc.size)}</span>
                    )}
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#2e3650] transition-colors text-gray-500 dark:text-gray-400" title="Descargar">
                      <Download size={15} />
                    </a>
                    <button type="button" onClick={() => deleteDocMutation.mutate(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500" title="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-[#2e3650] rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
              <Upload size={28} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {uploadDocMutation.isPending ? 'Subiendo...' : 'Haz clic para subir un documento'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, DOC, DOCX, XLS o XLSX · Máx. 20MB</p>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleDocFile} disabled={uploadDocMutation.isPending} className="hidden" />
            </label>
          </div>
        )}

        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors dark:text-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={saveMutation.isPending}
            className="px-8 py-2.5 bg-blue-900 dark:bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50">
            {saveMutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  );
}