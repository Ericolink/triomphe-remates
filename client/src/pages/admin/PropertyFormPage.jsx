import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Star, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPropertyById, createProperty, updateProperty,
  uploadImages, deleteImage, setCoverImage
} from '../../services/propertyService';
import Spinner from '../../components/ui/Spinner';

const FIELDS = [
  { key: 'title', label: 'Título *', type: 'text', col: 2 },
  { key: 'price', label: 'Precio *', type: 'number', col: 1 },
  { key: 'city', label: 'Ciudad *', type: 'select', col: 1, options: [{ value: 'juarez', label: 'Cd. Juárez' }, { value: 'chihuahua', label: 'Chihuahua' }, { value: 'queretaro', label: 'Querétaro' }] },
  { key: 'type', label: 'Tipo *', type: 'select', col: 1, options: [{ value: 'casa', label: 'Casa' }, { value: 'departamento', label: 'Departamento' }, { value: 'terreno', label: 'Terreno' }, { value: 'local', label: 'Local' }, { value: 'bodega', label: 'Bodega' }] },
  { key: 'status', label: 'Estatus', type: 'select', col: 1, options: [{ value: 'disponible', label: 'Disponible' }, { value: 'apartado', label: 'Apartado' }, { value: 'vendido', label: 'Vendido' }] },
  { key: 'squareMeters', label: 'M²', type: 'number', col: 1 },
  { key: 'bedrooms', label: 'Recámaras', type: 'number', col: 1 },
  { key: 'bathrooms', label: 'Baños', type: 'number', col: 1 },
  { key: 'address', label: 'Dirección', type: 'text', col: 2 },
  { key: 'bank', label: 'Banco', type: 'text', col: 1 },
  { key: 'loanNumber', label: 'No. Crédito', type: 'text', col: 1 },
  { key: 'description', label: 'Descripción', type: 'textarea', col: 2 },
];

const emptyForm = {
  title: '', price: '', city: 'juarez', type: 'casa', status: 'disponible',
  squareMeters: '', bedrooms: '', bathrooms: '', address: '',
  bank: '', loanNumber: '', description: '', isFeatured: false,
};

function toForm(p) {
  return {
    title: p.title || '', price: p.price || '', city: p.city || 'juarez',
    type: p.type || 'casa', status: p.status || 'disponible',
    squareMeters: p.squareMeters || '', bedrooms: p.bedrooms || '',
    bathrooms: p.bathrooms || '', address: p.address || '',
    bank: p.bank || '', loanNumber: p.loanNumber || '',
    description: p.description || '', isFeatured: p.isFeatured || false,
  };
}

export default function PropertyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [newFiles, setNewFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => getPropertyById(id),
    enabled: isEdit,
  });

  // Derivar el form de los datos de la query — sin useEffect
  const propertyData = data?.data;
  const [form, setForm] = useState(emptyForm);

  // Sincronizar cuando lleguen los datos por primera vez (solo en edición)
  const [synced, setSynced] = useState(false);
  if (isEdit && propertyData && !synced) {
    setForm(toForm(propertyData));
    setSynced(true);
  }

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

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles((f) => [...f, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((p) => [...p, ...newPreviews]);
  };

  const removeNewFile = (i) => {
    setNewFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.city || !form.type) {
      return toast.error('Título, precio, ciudad y tipo son requeridos');
    }
    saveMutation.mutate(form);
  };

  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '');
  const existingImages = data?.data?.images || [];

  if (isEdit && isLoading) return <Spinner size="lg" className="py-20" />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{isEdit ? 'Editar propiedad' : 'Nueva propiedad'}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isEdit ? 'Modifica los datos de la propiedad' : 'Completa los datos para agregar una propiedad'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos principales */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">Información general</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map(({ key, label, type, col, options }) => (
              <div key={key} className={col === 2 ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                {type === 'textarea' ? (
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                ) : type === 'select' ? (
                  <select
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}

            <div className="md:col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="featured"
                checked={form.isFeatured}
                onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                className="w-4 h-4 rounded accent-blue-900"
              />
              <label htmlFor="featured" className="text-sm text-gray-700">Destacar en el sitio público</label>
            </div>
          </div>
        </div>

        {/* Imágenes existentes */}
        {isEdit && existingImages.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-700 mb-4">Imágenes actuales</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {existingImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={`${apiBase}${img.url}`}
                    alt=""
                    className={`w-full aspect-square object-cover rounded-xl border-2 transition-colors ${img.isCover ? 'border-yellow-400' : 'border-transparent'}`}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1">
                    <button type="button" onClick={() => coverMutation.mutate(img.id)}
                      className="p-1 bg-yellow-400 rounded-lg" title="Hacer portada">
                      <Star size={12} className="text-blue-900" />
                    </button>
                    <button type="button" onClick={() => deleteImgMutation.mutate({ imgId: img.id })}
                      className="p-1 bg-red-500 rounded-lg" title="Eliminar">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                  {img.isCover && (
                    <span className="absolute top-1 left-1 bg-yellow-400 text-blue-900 text-xs px-1.5 py-0.5 rounded-md font-medium">
                      Portada
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subir nuevas imágenes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">
            {isEdit ? 'Agregar más imágenes' : 'Imágenes'}
          </h2>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Haz clic o arrastra imágenes aquí</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG o WEBP · Máx. 5MB por imagen</p>
            <input type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-full aspect-square object-cover rounded-xl border border-gray-200" />
                  <button type="button" onClick={() => removeNewFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saveMutation.isPending}
            className="px-8 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saveMutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  );
}