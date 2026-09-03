import { useId, useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserX, UserCheck, Camera, ShieldCheck, User, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  permanentDeleteUser,
} from '../../services/usersService';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import OverflowMenu from '../../components/ui/OverflowMenu';
import AdminFormModal from '../../components/ui/AdminFormModal';
import Pagination from '../../components/ui/Pagination';
import PasswordInput from '../../components/ui/PasswordInput';
import useFilePreviews from '../../hooks/useFilePreviews';
import useAuthStore from '../../store/authStore';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { formatDate } from '../../utils/formatters';
import { buildImageUrl } from '../../utils/images';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/constants';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'asistente_administrativo',
  supervisorId: '',
  currentPassword: '',
  newPassword: '',
};
const EMPTY_SHOW = { password: false, currentPassword: false, newPassword: false };

export default function UsersPage() {
  const { user: currentUser, updateUser: updateAuthUser, setToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | { user }
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(EMPTY_SHOW);
  const [photoFile, setPhotoFile] = useState(null);
  const fileInputRef = useRef(null);
  const formId = useId();

  const photoFiles = useMemo(() => (photoFile ? [photoFile] : []), [photoFile]);
  const localPhotoPreview = useFilePreviews(photoFiles)[0]?.url;
  const editingUser = modal && modal !== 'create' ? modal.user : null;
  const photoPreview = localPhotoPreview || editingUser?.profilePhoto || null;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers({ page, limit: 20 }),
  });

  // Lista completa (sin paginar) solo para poblar el selector "Coordinador asignado" del
  // formulario — se filtra a coordinador_ventas del lado del cliente, la misma lista ya se
  // usa en otros selectores de responsable (CreateLeadModal, etc.).
  const { data: allUsersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers(),
  });
  const coordinadores = (allUsersData?.data ?? []).filter(
    (u) => u.role === 'coordinador_ventas' && u.isActive
  );

  // Consulta aparte (1 fila) para el admin principal: es el usuario más antiguo
  // (id más bajo, createdAt ASC), pero puede no estar en la página que se ve ahora.
  const { data: masterData } = useQuery({
    queryKey: ['users', 'master'],
    queryFn: () => getUsers({ page: 1, limit: 1 }),
  });
  const masterAdminId = masterData?.data?.[0]?.id ?? null;

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success('Usuario creado');
      queryClient.invalidateQueries(['users']);
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al crear usuario'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => updateUser(id, formData),
    onSuccess: (res) => {
      toast.success('Usuario actualizado');
      queryClient.invalidateQueries(['users']);
      if (res.data?.id === currentUser?.id) {
        updateAuthUser(res.data);
        // Cambiar la propia contraseña/rol invalida el token anterior (tokenVersion) —
        // el backend reemite uno nuevo para no cerrar la sesión, hay que guardarlo.
        if (res.token) setToken(res.token);
      }
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al actualizar'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast.success('Usuario desactivado');
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error'),
  });

  const activateMutation = useMutation({
    mutationFn: activateUser,
    onSuccess: () => {
      toast.success('Usuario activado');
      queryClient.invalidateQueries(['users']);
    },
    onError: () => toast.error('Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: permanentDeleteUser,
    onSuccess: () => {
      toast.success('Usuario eliminado');
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al eliminar'),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowPass(EMPTY_SHOW);
    setPhotoFile(null);
    setModal('create');
  };

  const openEdit = (user) => {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      supervisorId: user.supervisorId || '',
      password: '',
      currentPassword: '',
      newPassword: '',
    });
    setShowPass(EMPTY_SHOW);
    setPhotoFile(null);
    setModal({ user });
  };

  const closeModal = () => {
    setModal(null);
    setPhotoFile(null);
    setShowPass(EMPTY_SHOW);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modal === 'create') {
      createMutation.mutate({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        supervisorId: form.role === 'asesor_ventas' ? form.supervisorId || null : null,
      });
    } else {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('role', form.role);
      fd.append('supervisorId', form.role === 'asesor_ventas' ? form.supervisorId || '' : '');
      if (form.newPassword) {
        fd.append('newPassword', form.newPassword);
        fd.append('currentPassword', form.currentPassword);
      }
      if (photoFile) fd.append('profilePhoto', photoFile);
      updateMutation.mutate({ id: modal.user.id, formData: fd });
    }
  };

  const confirmDelete = (u) => {
    setConfirm({
      title: `¿Eliminar a "${u.name}"?`,
      message: 'Esta acción no se puede deshacer. El usuario será eliminado permanentemente.',
      confirmLabel: 'Eliminar',
      onConfirm: () => {
        deleteMutation.mutate(u.id);
        setConfirm(null);
      },
    });
  };

  const confirmDeactivate = (u) => {
    setConfirm({
      title: `¿Desactivar a "${u.name}"?`,
      message:
        'No podrá iniciar sesión hasta que alguien lo reactive, pero sus datos, leads atendidos y bitácora se conservan intactos. A diferencia de "Eliminar", esta acción se puede revertir.',
      confirmLabel: 'Desactivar',
      danger: false,
      onConfirm: () => {
        deactivateMutation.mutate(u.id);
        setConfirm(null);
      },
    });
  };

  const togglePass = (field) => setShowPass((prev) => ({ ...prev, [field]: !prev[field] }));

  const isEditing = modal && modal !== 'create';
  const isBusy = createMutation.isPending || updateMutation.isPending;

  const canModify = (u) => u.id !== currentUser?.id;
  const canDelete = (u) => canModify(u) && u.id !== masterAdminId;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Usuarios</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {data?.pagination?.total ?? 0} usuarios registrados
          </p>
        </div>
        <motion.button
          whileHover={buttonHover}
          whileTap={buttonTap}
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-accent-400 dark:bg-accent-500 text-primary-900 px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
        >
          <Plus size={16} /> Nuevo usuario
        </motion.button>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] overflow-hidden"
      >
        {isLoading ? (
          <Spinner size="lg" className="py-16" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-[#1a1f2e] border-b border-gray-100 dark:border-[#2e3650]">
                <tr>
                  {['Usuario', 'Email', 'Rol', 'Último acceso', 'Estado', 'Acciones'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y divide-gray-50 dark:divide-[#2e3650]"
              >
                {data?.data?.map((u) => (
                  <motion.tr
                    key={u.id}
                    variants={fadeInUp}
                    className="hover:bg-gray-50 dark:hover:bg-[#2e3650]/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.profilePhoto ? (
                          <img
                            src={buildImageUrl(u.profilePhoto, 80)}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-[#2e3650]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary-900 flex items-center justify-center text-white text-sm font-bold">
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <p className="font-medium text-gray-800 dark:text-gray-100">{u.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[u.role]}`}
                        >
                          {u.role === 'admin' && <ShieldCheck size={11} />}
                          {ROLE_LABELS[u.role]}
                          {u.id === currentUser?.id
                            ? ' · Tú'
                            : u.id === masterAdminId
                              ? ' · Principal'
                              : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(u.lastLogin, 'Nunca')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          u.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <motion.button
                          onClick={() => openEdit(u)}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </motion.button>

                        {(canModify(u) || canDelete(u)) && (
                          <OverflowMenu
                            items={[
                              ...(canModify(u)
                                ? [
                                    u.isActive
                                      ? {
                                          label: 'Desactivar',
                                          icon: <UserX size={14} />,
                                          onClick: () => confirmDeactivate(u),
                                        }
                                      : {
                                          label: 'Activar',
                                          icon: <UserCheck size={14} />,
                                          onClick: () => activateMutation.mutate(u.id),
                                        },
                                  ]
                                : []),
                              ...(canDelete(u)
                                ? [
                                    {
                                      label: 'Eliminar',
                                      icon: <Trash2 size={14} />,
                                      danger: true,
                                      onClick: () => confirmDelete(u),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
        <Pagination
          pagination={data?.pagination}
          page={page}
          onPageChange={setPage}
          className="p-4 border-t border-gray-100 dark:border-[#2e3650]"
        />
      </motion.div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || 'Eliminar'}
        danger={confirm?.danger ?? true}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      {/* Modal */}
      <AdminFormModal
        open={Boolean(modal)}
        onClose={closeModal}
        title={isEditing ? 'Editar usuario' : 'Nuevo usuario'}
        maxWidth="max-w-md"
      >
        {modal && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Foto de perfil (solo en edición) */}
            {isEditing && (
              <div className="flex flex-col items-center gap-3 mb-2">
                <div className="relative">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="preview"
                      className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-100 dark:ring-primary-900/40"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary-900 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-primary-100 dark:ring-primary-900/40">
                      {form.name?.[0]?.toUpperCase() || <User size={28} />}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Cambiar foto"
                    className="absolute -bottom-1 -right-1 bg-accent-400 text-primary-900 p-1.5 rounded-full hover:bg-accent-300 transition-colors shadow-md"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <p className="text-xs text-gray-400">Clic en la cámara para cambiar foto</p>
              </div>
            )}

            <div>
              <label
                htmlFor={`${formId}-name`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Nombre
              </label>
              <input
                id={`${formId}-name`}
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-email`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Email
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-role`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Rol
              </label>
              <select
                id={`${formId}-role`}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {form.role === 'asesor_ventas' && (
              <div>
                <label
                  htmlFor={`${formId}-supervisorId`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Coordinador asignado (opcional)
                </label>
                <select
                  id={`${formId}-supervisorId`}
                  value={form.supervisorId}
                  onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                >
                  <option value="">Sin coordinador</option>
                  {coordinadores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isEditing ? (
              <div>
                <label
                  htmlFor={`${formId}-password`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Contraseña
                </label>
                <PasswordInput
                  id={`${formId}-password`}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  showPass={showPass.password}
                  onToggle={() => togglePass('password')}
                />
              </div>
            ) : (
              <details className="group">
                <summary className="text-xs font-medium text-primary-600 dark:text-primary-400 cursor-pointer select-none">
                  Cambiar contraseña (opcional)
                </summary>
                <div className="mt-3 space-y-3">
                  {modal.user.id === currentUser?.id && (
                    <div>
                      <label
                        htmlFor={`${formId}-currentPassword`}
                        className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                      >
                        Contraseña actual
                      </label>
                      <PasswordInput
                        id={`${formId}-currentPassword`}
                        value={form.currentPassword}
                        onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                        showPass={showPass.currentPassword}
                        onToggle={() => togglePass('currentPassword')}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor={`${formId}-newPassword`}
                      className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                    >
                      Nueva contraseña
                    </label>
                    <PasswordInput
                      id={`${formId}-newPassword`}
                      value={form.newPassword}
                      onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                      showPass={showPass.newPassword}
                      onToggle={() => togglePass('newPassword')}
                    />
                  </div>
                </div>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                type="submit"
                disabled={isBusy}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 bg-accent-400 dark:bg-accent-500 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors disabled:opacity-50"
              >
                {isBusy ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear usuario'}
              </motion.button>
            </div>
          </form>
        )}
      </AdminFormModal>
    </motion.div>
  );
}
