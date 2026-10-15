import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, DEFAULT_DISH_IMAGE, getImageUrl, hasDishImage } from '../../../config';
import { haptics } from '../../../utils/haptics';
import authStorage from '../../../app/authStorage';
import { useDishBackup } from '../../../app/useDishBackup';
import { getBackupMode } from '../../../app/dishBackupApi';
import filterIcon from '../../../assets/icons/filterIcon.svg';
import addBtnIcon from '../../../assets/icons/Add.svg';
import DishImageField from './DishImageField';
import MenuImportDialog from './MenuImportDialog';
import TrashDialog from './TrashDialog';
import './MenuList.css';

// Inline Icons
const ThreeDotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5"></circle>
    <circle cx="12" cy="5" r="1.5"></circle>
    <circle cx="12" cy="19" r="1.5"></circle>
  </svg>
);

const FunnelIcon = () => (
  <img src={filterIcon} alt="Filter" style={{ width: '40px', height: '40px', display: 'block' }} />
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="20" y1="20" x2="16.05" y2="16.05"></line>
  </svg>
);

const CloseSmallIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12"></path>
  </svg>
);

const GridViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
  </svg>
);

const ListViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const ImportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const TrashSmallIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const dishCountText = (count) => `${count} dish${count === 1 ? '' : 'es'}`;

const broadcastMenuUpdate = (payload = {}) => {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('thevingo_menu_updates');
      channel.postMessage({ type: 'MENU_UPDATED', ...payload });
      channel.close();
    }
  } catch {
    // Cross-tab sync is best-effort.
  }
};

// Availability flags arrive as booleans, 0/1 or 'true'/'false' depending on the source.
const isFlagSet = (value) => value === true || value === 1 || value === 'true';

const revokeBlobUrl = (url) => {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
};

function MenuList({ categories, setCategories, onMenuRefresh, openTrashRequested = false, onTrashRequestHandled }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dish backup setting decides the delete wording and whether Trash is offered.
  // 'on' -> deleted dishes go to Trash, 'off' -> permanent, 'unavailable' -> today's behaviour.
  const dishBackup = useDishBackup();
  const backupMode = getBackupMode(dishBackup);
  const isTrashAvailable = backupMode !== 'unavailable';
  const { reload: reloadDishBackup } = dishBackup;
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Settings -> "Open Trash" navigates here with a request to open Trash once
  // the backup status is known (ignored when the feature is unavailable).
  useEffect(() => {
    if (!openTrashRequested || dishBackup.status === 'loading') return;
    if (isTrashAvailable) setIsTrashOpen(true);
    onTrashRequestHandled?.();
  }, [openTrashRequested, dishBackup.status, isTrashAvailable, onTrashRequestHandled]);

  // Keep the Trash count fresh after a delete when dishes may have gone to Trash.
  const refreshTrashCountAfterDelete = () => {
    if (backupMode === 'on') reloadDishBackup();
  };

  const openTrash = () => {
    haptics?.light?.();
    setIsFabMenuOpen(false);
    setIsTrashOpen(true);
  };

  const closeTrash = useCallback(() => setIsTrashOpen(false), []);

  const handleTrashChanged = useCallback((change) => {
    reloadDishBackup();
    if (change?.type === 'restore') {
      // Restored dishes (and revived categories) come from the server.
      onMenuRefresh?.();
      broadcastMenuUpdate();
    }
  }, [reloadDishBackup, onMenuRefresh]);

  // Custom Filter Dialog States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedCategory, setAppliedCategory] = useState('all');
  const [appliedAvailability, setAppliedAvailability] = useState({ Breakfast: true, Lunch: true, Dinner: true });
  const [appliedDishType, setAppliedDishType] = useState('all');

  const [tempFilterCategory, setTempFilterCategory] = useState('all');
  const [tempFilterAvailability, setTempFilterAvailability] = useState({ Breakfast: true, Lunch: true, Dinner: true });
  const [tempFilterDishType, setTempFilterDishType] = useState('all');

  const handleOpenFilterModal = () => {
    setTempFilterCategory(appliedCategory);
    setTempFilterAvailability({ ...appliedAvailability });
    setTempFilterDishType(appliedDishType);
    setIsFilterModalOpen(true);
  };

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setAppliedCategory(tempFilterCategory);
    setAppliedAvailability({ ...tempFilterAvailability });
    setAppliedDishType(tempFilterDishType);
    setIsFilterModalOpen(false);
  };

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('biriyani');
  const [newItemIsVeg, setNewItemIsVeg] = useState(true);
  const [newItemImage, setNewItemImage] = useState('');
  const [availBreakfast, setAvailBreakfast] = useState(true);
  const [availLunch, setAvailLunch] = useState(true);
  const [availDinner, setAvailDinner] = useState(true);
  const [imageFile, setImageFile] = useState(null);

  // Dish Details & Edit Modal States
  const [selectedDish, setSelectedDish] = useState(null);
  const [selectedDishCategory, setSelectedDishCategory] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit Dish Form States
  const [editDishName, setEditDishName] = useState('');
  const [editDishPrice, setEditDishPrice] = useState('');
  const [editDishCategory, setEditDishCategory] = useState('');
  const [editDishIsVeg, setEditDishIsVeg] = useState(true);
  const [editDishDescription, setEditDishDescription] = useState('');
  const [editAvailBreakfast, setEditAvailBreakfast] = useState(true);
  const [editAvailLunch, setEditAvailLunch] = useState(true);
  const [editAvailDinner, setEditAvailDinner] = useState(true);
  const [editDishImage, setEditDishImage] = useState('');
  const [editImageFile, setEditImageFile] = useState(null);
  // URL picked from "Suggest image" (sent as the `image` field on save)
  const [editImageUrl, setEditImageUrl] = useState('');
  // True when the user removed the existing image (sent as `remove_image`)
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const handleOpenDishDetails = (item, category) => {
    haptics?.light?.();
    setSelectedDish(item);
    setSelectedDishCategory(category);
    setIsDetailsModalOpen(true);
  };

  const handleOpenEditModal = (item, category) => {
    haptics?.light?.();
    const currentItem = item || selectedDish;
    const currentCat = category || selectedDishCategory;
    if (!currentItem) return;

    setSelectedDish(currentItem);
    setSelectedDishCategory(currentCat);
    setEditDishName(currentItem.name || '');
    setEditDishPrice(currentItem.price !== undefined ? String(currentItem.price) : '');
    setEditDishCategory(currentCat?.id?.toString() || currentItem.categoryId?.toString() || currentItem.category_id?.toString() || categories[0]?.id?.toString() || '');
    setEditDishIsVeg(currentItem.isVeg === true || currentItem.isVeg === 1 || currentItem.isVeg === 'true');
    setEditDishDescription(currentItem.description || '');
    setEditAvailBreakfast(currentItem.availableBreakfast === true || currentItem.availableBreakfast === 1 || currentItem.availableBreakfast === 'true');
    setEditAvailLunch(currentItem.availableLunch === true || currentItem.availableLunch === 1 || currentItem.availableLunch === 'true');
    setEditAvailDinner(currentItem.availableDinner === true || currentItem.availableDinner === 1 || currentItem.availableDinner === 'true');
    setEditDishImage(hasDishImage(currentItem.image) ? getImageUrl(currentItem.image) : '');
    setEditImageFile(null);
    setEditImageUrl('');
    setEditRemoveImage(false);
    setEditError('');
    setIsDetailsModalOpen(false);
    setIsEditModalOpen(true);
  };

  const handleEditImageFile = (file) => {
    revokeBlobUrl(editDishImage);
    setEditImageFile(file);
    setEditImageUrl('');
    setEditRemoveImage(false);
    setEditDishImage(URL.createObjectURL(file));
  };

  const handleEditImagePickUrl = (url) => {
    revokeBlobUrl(editDishImage);
    setEditImageFile(null);
    setEditImageUrl(url);
    setEditRemoveImage(false);
    setEditDishImage(url);
  };

  const handleEditImageRemove = () => {
    revokeBlobUrl(editDishImage);
    setEditImageFile(null);
    setEditImageUrl('');
    setEditRemoveImage(true);
    setEditDishImage('');
  };

  const handleEditDishSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editDishName.trim()) {
      setEditError('Dish name is required.');
      return;
    }
    const parsedPrice = parseFloat(editDishPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setEditError('Please enter a valid positive price.');
      return;
    }
    if (!editDishCategory) {
      setEditError('Please select a category.');
      return;
    }

    setEditLoading(true);

    try {
      const token = authStorage.getToken();
      const formData = new FormData();
      formData.append('name', editDishName.trim());
      formData.append('price', parsedPrice);
      formData.append('categoryId', editDishCategory);
      formData.append('isVeg', editDishIsVeg);
      formData.append('description', editDishDescription.trim());
      formData.append('availableBreakfast', editAvailBreakfast);
      formData.append('availableLunch', editAvailLunch);
      formData.append('availableDinner', editAvailDinner);

      // Image: new upload > picked suggestion URL > explicit removal.
      // When untouched, no image field is sent and the backend keeps the current one.
      if (editImageFile) {
        formData.append('image', editImageFile);
      } else if (editImageUrl) {
        formData.append('image', editImageUrl);
      } else if (editRemoveImage) {
        formData.append('remove_image', 'true');
      }

      const response = await fetch(`${API_URL}/api/menu/dishes/${selectedDish.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        const updatedDishData = {
          ...selectedDish,
          ...data.dish,
          name: editDishName.trim(),
          price: parsedPrice,
          isVeg: editDishIsVeg,
          description: editDishDescription.trim(),
          availableBreakfast: editAvailBreakfast,
          availableLunch: editAvailLunch,
          availableDinner: editAvailDinner,
          image: data.dish?.image ?? (editRemoveImage ? null : selectedDish.image)
        };
        if (editRemoveImage && !editImageFile && !editImageUrl && !hasDishImage(data.dish?.image)) {
          updatedDishData.image = null;
        }

        // Update state in categories immediately
        setCategories(prev => {
          return prev.map(cat => {
            const isTargetCategory = String(cat.id) === String(editDishCategory);
            const hadDish = cat.items.some(i => String(i.id) === String(selectedDish.id));

            if (isTargetCategory && hadDish) {
              return {
                ...cat,
                items: cat.items.map(i => String(i.id) === String(selectedDish.id) ? updatedDishData : i)
              };
            } else if (isTargetCategory && !hadDish) {
              return {
                ...cat,
                items: [...cat.items, updatedDishData]
              };
            } else if (!isTargetCategory && hadDish) {
              return {
                ...cat,
                items: cat.items.filter(i => String(i.id) !== String(selectedDish.id))
              };
            }
            return cat;
          });
        });

        // Instant cross-tab broadcast for any open public QR menu pages
        broadcastMenuUpdate({ dishId: selectedDish.id });

        haptics?.success?.();
        setSelectedDish(updatedDishData);
        setIsEditModalOpen(false);
      } else {
        haptics?.error?.();
        setEditError(data.message || 'Failed to update dish.');
      }
    } catch (err) {
      console.error('Update dish error:', err);
      haptics?.error?.();
      setEditError('An error occurred while updating the dish. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  // FAB Pop-up menu states
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const fabRef = useRef(null);

  // Grid/List view toggle (desktop only). Remembered per-browser like the dark
  // theme preference, defaulting to the existing grid layout.
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = window.localStorage.getItem('thevingo_menu_view');
      return stored === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetViewMode = (mode) => {
    if (mode === viewMode) return;
    haptics?.selection?.();
    setViewMode(mode);
    try {
      window.localStorage.setItem('thevingo_menu_view', mode);
    } catch {
      // Best-effort persistence only
    }
  };

  // Custom states for category dropdown and selection mode
  const [activeCategoryMenu, setActiveCategoryMenu] = useState(null);
  const [selectionCategoryId, setSelectionCategoryId] = useState(null);
  const [selectedDishIds, setSelectedDishIds] = useState([]);

  // Close category three-dot menu on click outside
  useEffect(() => {
    function handleClickOutsideCategoryMenu() {
      setActiveCategoryMenu(null);
    }
    if (activeCategoryMenu !== null) {
      document.addEventListener('click', handleClickOutsideCategoryMenu);
    }
    return () => {
      document.removeEventListener('click', handleClickOutsideCategoryMenu);
    };
  }, [activeCategoryMenu]);

  const handleToggleSelectDish = (dishId) => {
    setSelectedDishIds(prev => {
      if (prev.includes(dishId)) {
        return prev.filter(id => id !== dishId);
      } else {
        return [...prev, dishId];
      }
    });
  };

  const handleCancelSelection = () => {
    setSelectionCategoryId(null);
    setSelectedDishIds([]);
  };

  // Delete-selected-dishes confirmation dialog + in-flight flag
  const [isDeleteDishesOpen, setIsDeleteDishesOpen] = useState(false);
  const [isDeletingDishes, setIsDeletingDishes] = useState(false);

  const requestDeleteSelectedDishes = () => {
    if (selectedDishIds.length === 0) return;
    haptics?.warning?.();
    setIsDeleteDishesOpen(true);
  };

  const handleCancelDeleteDishes = () => {
    if (isDeletingDishes) return;
    setIsDeleteDishesOpen(false);
  };

  const handleDeleteSelectedDishes = async () => {
    if (selectedDishIds.length === 0 || isDeletingDishes) return;
    setIsDeletingDishes(true);

    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/api/menu/dishes/delete-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dishIds: selectedDishIds })
      });

      if (response.ok) {
        setCategories(prev => prev.map(cat => {
          if (cat.id === selectionCategoryId) {
            return {
              ...cat,
              items: cat.items.filter(item => !selectedDishIds.includes(item.id))
            };
          }
          return cat;
        }));
        setSelectionCategoryId(null);
        setSelectedDishIds([]);
        setIsDeleteDishesOpen(false);
        haptics?.success?.();
        refreshTrashCountAfterDelete();

        // Instant cross-tab broadcast
        broadcastMenuUpdate();
      } else {
        haptics?.error?.();
        alert('Failed to delete selected dishes.');
      }
    } catch (err) {
      console.error(err);
      haptics?.error?.();
      alert('Error deleting selected dishes.');
    } finally {
      setIsDeletingDishes(false);
    }
  };

  // Delete-category confirmation dialog: { id, name, dishCount } | null
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const requestDeleteCategory = (category) => {
    haptics?.warning?.();
    // Count from the unfiltered list so active filters don't under-report.
    const source = categories.find(cat => String(cat.id) === String(category.id)) || category;
    setCategoryToDelete({
      id: category.id,
      name: category.name,
      dishCount: Array.isArray(source.items) ? source.items.length : 0
    });
    setActiveCategoryMenu(null);
  };

  const handleCancelDeleteCategory = () => {
    if (isDeletingCategory) return;
    setCategoryToDelete(null);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete || isDeletingCategory) return;
    const categoryId = categoryToDelete.id;
    setIsDeletingCategory(true);

    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/api/menu/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setCategories(prev => prev.filter(cat => String(cat.id) !== String(categoryId)));
        if (String(appliedCategory) === String(categoryId)) {
          setAppliedCategory('all');
        }
        if (String(selectionCategoryId) === String(categoryId)) {
          setSelectionCategoryId(null);
          setSelectedDishIds([]);
        }
        setCategoryToDelete(null);
        haptics?.success?.();
        refreshTrashCountAfterDelete();

        // Instant cross-tab broadcast
        broadcastMenuUpdate();
      } else {
        haptics?.error?.();
        alert('Failed to delete category.');
      }
    } catch (err) {
      console.error(err);
      haptics?.error?.();
      alert('Error deleting category.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // Delete-all confirmation dialog: boolean open state + in-flight flag
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const totalDishCount = categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const requestDeleteAll = () => {
    haptics?.warning?.();
    setIsFabMenuOpen(false);
    setIsDeleteAllOpen(true);
  };

  const handleCancelDeleteAll = () => {
    if (isDeletingAll) return;
    setIsDeleteAllOpen(false);
  };

  const handleConfirmDeleteAll = async () => {
    if (isDeletingAll) return;
    setIsDeletingAll(true);

    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/api/menu/all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setCategories([]);
        setAppliedCategory('all');
        setSelectionCategoryId(null);
        setSelectedDishIds([]);
        setIsDeleteAllOpen(false);
        haptics?.success?.();
        refreshTrashCountAfterDelete();

        // Instant cross-tab broadcast
        broadcastMenuUpdate();
      } else {
        haptics?.error?.();
        alert('Failed to delete the menu.');
      }
    } catch (err) {
      console.error(err);
      haptics?.error?.();
      alert('Error deleting the menu.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const toggleFilter = () => {
    handleOpenFilterModal();
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;

    try {
      const token = authStorage.getToken();
      const formData = new FormData();
      formData.append('name', newItemName);
      formData.append('price', newItemPrice);
      formData.append('categoryId', newItemCategory);
      formData.append('isVeg', newItemIsVeg);
      formData.append('availableBreakfast', availBreakfast);
      formData.append('availableLunch', availLunch);
      formData.append('availableDinner', availDinner);

      // Only send an image when the user chose one; no image => no field,
      // so the dish is stored without a stock photo.
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (newItemImage && !newItemImage.startsWith('blob:')) {
        // URL picked from "Suggest image"
        formData.append('image', newItemImage);
      }

      const response = await fetch(`${API_URL}/api/menu/dishes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(prev => prev.map(cat => {
          if (cat.id.toString() === newItemCategory.toString()) {
            return {
              ...cat,
              items: [...cat.items, data.dish]
            };
          }
          return cat;
        }));

        setNewItemName('');
        setNewItemPrice('');
        setNewItemIsVeg(true);
        revokeBlobUrl(newItemImage);
        setNewItemImage('');
        setImageFile(null);
        setAvailBreakfast(true);
        setAvailLunch(true);
        setAvailDinner(true);
        setIsModalOpen(false);

        // Instant cross-tab broadcast for any open public QR menu pages
        broadcastMenuUpdate({ dishId: data.dish?.id });
      } else {
        alert(data.message || 'Failed to create dish');
      }
    } catch (err) {
      console.error('Error adding dish:', err);
      alert('Failed to add dish');
    }
  };

  const handleNewImageFile = (file) => {
    revokeBlobUrl(newItemImage);
    setImageFile(file);
    setNewItemImage(URL.createObjectURL(file));
  };

  const handleNewImagePickUrl = (url) => {
    revokeBlobUrl(newItemImage);
    setImageFile(null);
    setNewItemImage(url);
  };

  const handleNewImageRemove = () => {
    revokeBlobUrl(newItemImage);
    setImageFile(null);
    setNewItemImage('');
  };

  const handleAddCategorySubmit = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/api/menu/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(prev => [...prev, data.category]);
        setNewCategoryName('');
        setIsCategoryModalOpen(false);
      } else {
        alert(data.message || 'Failed to create category');
      }
    } catch (err) {
      console.error('Error adding category:', err);
      alert('Failed to add category');
    }
  };

  const openImportModal = () => {
    haptics?.light?.();
    setIsFabMenuOpen(false);
    setIsImportModalOpen(true);
  };

  // The import dialog (MenuImportDialog) validates the whole CSV before any
  // request is sent, shows progress while importing and reports failures.
  const closeImportModal = useCallback(() => setIsImportModalOpen(false), []);

  const filteredCategories = categories
    .filter(cat => {
      if (appliedCategory !== 'all') {
        return String(cat.id) === String(appliedCategory) || cat.name === appliedCategory;
      }
      return true;
    })
    .map(cat => {
      const filteredItems = cat.items.filter(item => {
        // Search Query filter
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Dish Type (Veg/Non Veg) filter
        let matchesDishType = true;
        if (appliedDishType === 'veg') {
          matchesDishType = item.isVeg === true || item.isVeg === 1 || item.isVeg === 'true';
        } else if (appliedDishType === 'non-veg') {
          matchesDishType = item.isVeg === false || item.isVeg === 0 || item.isVeg === 'false';
        }

        // Availability filter
        let matchesAvailability = false;
        if (appliedAvailability.Breakfast && (item.availableBreakfast === true || item.availableBreakfast === 1 || item.availableBreakfast === 'true')) {
          matchesAvailability = true;
        }
        if (appliedAvailability.Lunch && (item.availableLunch === true || item.availableLunch === 1 || item.availableLunch === 'true')) {
          matchesAvailability = true;
        }
        if (appliedAvailability.Dinner && (item.availableDinner === true || item.availableDinner === 1 || item.availableDinner === 'true')) {
          matchesAvailability = true;
        }
        const noAvailabilityChecked = !appliedAvailability.Breakfast && !appliedAvailability.Lunch && !appliedAvailability.Dinner;
        if (noAvailabilityChecked) {
          matchesAvailability = true;
        }

        return matchesSearch && matchesDishType && matchesAvailability;
      });

      return {
        ...cat,
        items: filteredItems
      };
    });

  // Active filter chips (each removable individually)
  const activeFilterChips = [];
  if (appliedCategory !== 'all') {
    const filterCat = categories.find(cat => String(cat.id) === String(appliedCategory) || cat.name === appliedCategory);
    activeFilterChips.push({
      key: 'category',
      label: 'Category',
      value: filterCat?.name || String(appliedCategory),
      onRemove: () => setAppliedCategory('all')
    });
  }
  if (appliedDishType !== 'all') {
    activeFilterChips.push({
      key: 'dishType',
      label: 'Type',
      value: appliedDishType === 'veg' ? 'Veg' : 'Non Veg',
      onRemove: () => setAppliedDishType('all')
    });
  }
  const enabledMealTimes = ['Breakfast', 'Lunch', 'Dinner'].filter(slot => appliedAvailability[slot]);
  // None checked behaves like "all" in the filter logic, so only 1–2 checked is a real filter.
  if (enabledMealTimes.length > 0 && enabledMealTimes.length < 3) {
    activeFilterChips.push({
      key: 'availability',
      label: 'Available',
      value: enabledMealTimes.join(', '),
      onRemove: () => setAppliedAvailability({ Breakfast: true, Lunch: true, Dinner: true })
    });
  }
  const hasActiveFilters = activeFilterChips.length > 0;

  const handleClearAllFilters = () => {
    haptics?.light?.();
    setAppliedCategory('all');
    setAppliedAvailability({ Breakfast: true, Lunch: true, Dinner: true });
    setAppliedDishType('all');
  };

  const isAnyFilterActive = Boolean(searchQuery.trim()) || hasActiveFilters;

  const displayCategories = isAnyFilterActive
    ? filteredCategories.filter(cat => cat.items.length > 0)
    : filteredCategories;

  return (
    <>
      <div className="search-filter-container menu-toolbar">
        <div className="search-bar-wrapper menu-search-wrapper">
          <span className="menu-search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search menu items..."
            className="search-input landing_placeholder"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                setSearchQuery('');
              }
            }}
            aria-label="Search menu items"
          />
          {searchQuery && (
            <button
              type="button"
              className="menu-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <CloseSmallIcon size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="filter-btn menu-filter-btn"
          onClick={toggleFilter}
          title={hasActiveFilters ? `${activeFilterChips.length} filter${activeFilterChips.length === 1 ? '' : 's'} applied. Click to change.` : 'Filter dishes'}
          aria-label="Filter dishes"
        >
          <FunnelIcon />
          {hasActiveFilters && <span className="menu-filter-btn-dot" aria-hidden="true"></span>}
        </button>

        <div className="menu-view-toggle" role="group" aria-label="Menu layout">
          <button
            type="button"
            className={`menu-view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            title="Grid view"
          >
            <GridViewIcon />
          </button>
          <button
            type="button"
            className={`menu-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('list')}
            aria-pressed={viewMode === 'list'}
            title="List view"
          >
            <ListViewIcon />
          </button>
        </div>

        <button
          type="button"
          className="menu-import-btn"
          onClick={openImportModal}
          title="Import dishes from a CSV file"
        >
          <ImportIcon />
          Import menu
        </button>

        {isTrashAvailable && (
          <button
            type="button"
            className="menu-trash-btn"
            onClick={openTrash}
            title={`Trash: ${dishCountText(dishBackup.trashCount)} you can restore`}
            aria-label={`Open Trash (${dishCountText(dishBackup.trashCount)})`}
          >
            <TrashSmallIcon />
            Trash
            <span className="menu-trash-count" aria-hidden="true">{dishBackup.trashCount}</span>
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="menu-filter-chips" aria-label="Active filters">
          <span className="menu-filter-chips-label">Filtered by</span>
          {activeFilterChips.map(chip => (
            <span key={chip.key} className="menu-filter-chip">
              <span className="menu-filter-chip-key">{chip.label}:</span>
              {chip.value}
              <button
                type="button"
                className="menu-filter-chip-remove"
                onClick={() => {
                  haptics?.light?.();
                  chip.onRemove();
                }}
                aria-label={`Remove ${chip.label} filter`}
                title={`Remove ${chip.label} filter`}
              >
                <CloseSmallIcon size={10} />
              </button>
            </span>
          ))}
          <button type="button" className="menu-filter-clear-all" onClick={handleClearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      {categories.length > 0 ? (
        displayCategories.length > 0 ? (
          displayCategories.map(category => (
            <section key={category.id} className="category-section">
              <div className="category-header">
                <h3 className="category-title landing_heading2">{category.name}</h3>
                <div style={{ position: 'relative' }}>
                  <button 
                    className="category-options-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCategoryMenu(activeCategoryMenu === category.id ? null : category.id);
                    }}
                  >
                    <ThreeDotsIcon />
                  </button>
                  {activeCategoryMenu === category.id && (
                    <div className="category-dropdown-menu">
                      <button
                        type="button"
                        className="category-dropdown-item landing_body"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectionCategoryId(category.id);
                          setSelectedDishIds([]);
                          setActiveCategoryMenu(null);
                        }}
                      >
                        Delete dishes
                      </button>
                      <button
                        type="button"
                        className="category-dropdown-item delete-option landing_body"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteCategory(category);
                        }}
                      >
                        Delete category
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`food-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
                {category.items.length > 0 ? (
                  category.items.map(item => (
                    <article 
                      key={item.id} 
                      className={`food-card ${selectionCategoryId === category.id && selectedDishIds.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => {
                        if (selectionCategoryId === category.id) {
                          handleToggleSelectDish(item.id);
                        } else if (viewMode === 'list') {
                          handleOpenEditModal(item, category);
                        } else {
                          handleOpenDishDetails(item, category);
                        }
                      }}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      {selectionCategoryId === category.id && (
                        <div className="dish-select-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="offer-row-checkbox"
                            checked={selectedDishIds.includes(item.id)}
                            onChange={() => handleToggleSelectDish(item.id)}
                          />
                        </div>
                      )}
                      <div className="food-card-body">
                        <div className="food-img-wrapper">
                          <img 
                            src={getImageUrl(item.image)} 
                            alt={item.name} 
                            className="food-img" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_DISH_IMAGE;
                            }}
                          />
                        </div>
                        <div className="food-details">
                          <h4 className="food-name landing_body">{item.name}</h4>
                          <p className="food-price landing_body">{item.price} Rs</p>

                          <div className="veg-indicator">
                            <div className={`veg-box ${!item.isVeg ? 'non-veg' : ''}`}>
                              <div className={`veg-dot ${!item.isVeg ? 'non-veg' : ''}`}></div>
                            </div>
                            <span className="veg-text landing_body">Veg</span>
                          </div>

                          {viewMode === 'list' && (
                            <div className="food-avail-group" aria-label="Availability">
                              <span className={`dish-avail-badge${isFlagSet(item.availableBreakfast) ? ' is-available' : ''}`}>Breakfast</span>
                              <span className={`dish-avail-badge${isFlagSet(item.availableLunch) ? ' is-available' : ''}`}>Lunch</span>
                              <span className={`dish-avail-badge${isFlagSet(item.availableDinner) ? ' is-available' : ''}`}>Dinner</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="category-empty-state" style={{ gridColumn: '1 / -1', padding: '24px', background: '#f9fafb', borderRadius: '8px', border: '1.5px dashed var(--border)', textAlign: 'center', fontSize: 'var(--label-size)', color: 'var(--text-muted)' }}>
                    No dishes in this category yet.
                  </div>
                )}
              </div>
            </section>
          ))
        ) : (
          <div className="empty-state">
            <h4 className="empty-state-title">No menu items found</h4>
            <p className="empty-state-desc">Try search terms or adjust the veg/non-veg filters.</p>
          </div>
        )
      ) : (
        /* Empty State: Import Menu */
        <div className="import-menu-container menu-empty-import">
          <h4 className="menu-empty-import-title">Your menu is empty</h4>
          <p className="menu-empty-import-desc">Import your dishes from a CSV file, or add them one by one with the + button.</p>
          <button type="button" className="menu-empty-import-btn" onClick={openImportModal}>
            Import menu
          </button>
          {isTrashAvailable && dishBackup.trashCount > 0 && (
            <button type="button" className="menu-empty-trash-link" onClick={openTrash}>
              Restore deleted dishes from Trash ({dishBackup.trashCount})
            </button>
          )}
        </div>
      )}

      {selectionCategoryId !== null ? (
        <div className="menu-fab-wrapper" style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 100, display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={handleCancelSelection}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '25px',
              backgroundColor: 'var(--border)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              fontSize: 'var(--body-large-size)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-dark)'
            }}
            title="Cancel Selection"
          >
            ✕
          </button>
          
          <button
            type="button"
            onClick={requestDeleteSelectedDishes}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '25px',
              backgroundColor: '#EF5C43',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              opacity: selectedDishIds.length === 0 ? 0.6 : 1
            }}
            title="Delete Selected Dishes"
            disabled={selectedDishIds.length === 0}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      ) : (
        /* Floating Action Button (FAB) toggles Options Menu */
        <div ref={fabRef} className="menu-fab-wrapper" style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 100 }}>
          {isFabMenuOpen && (
            <div className="fab-options-menu">
              <button
                type="button"
                className="fab-option-item"
                onClick={() => {
                  setIsCategoryModalOpen(true);
                  setIsFabMenuOpen(false);
                }}
              >
                Category
              </button>
              <button
                type="button"
                className="fab-option-item"
                onClick={() => {
                  setNewItemCategory(categories[0]?.id || 'biriyani');
                  setIsModalOpen(true);
                  setIsFabMenuOpen(false);
                }}
              >
                Item
              </button>
              <button
                type="button"
                className="fab-option-item"
                onClick={openImportModal}
              >
                Import menu
              </button>
              {isTrashAvailable && (
                <button
                  type="button"
                  className="fab-option-item fab-option-trash"
                  onClick={openTrash}
                  aria-label={`Trash (${dishCountText(dishBackup.trashCount)})`}
                >
                  Trash ({dishBackup.trashCount})
                </button>
              )}
              {categories.length > 0 && (
                <button
                  type="button"
                  className="fab-option-item fab-option-item-danger"
                  onClick={requestDeleteAll}
                >
                  Delete all
                </button>
              )}
            </div>
          )}

          <button
            className="fab-img-btn-toggle"
            onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
            title="Add Action"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'block',
              transition: 'transform 0.2s'
            }}
          >
            {isFabMenuOpen ? (
              <div className="close-fab-icon">
                <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="50" height="50" rx="25" fill="#EF5C43" />
                  <path d="M18 18L32 32M32 18L18 32" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <img src={addBtnIcon} alt="Add Action" style={{ width: '50px', height: '50px', display: 'block' }} />
            )}
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content dish-modal-content">
            <div className="modal-header dish-modal-header">
              <h3 className="modal-title dish-modal-title landing_heading2">Add new dish</h3>
            </div>

            <form onSubmit={handleAddItemSubmit} className="dish-modal-form">
              {/* Row 1: Dish name & Pricing */}
              <div className="dish-form-grid-row">
                <div className="dish-form-group">
                  <label className="dish-label landing_body">Dish name</label>
                  <input
                    type="text"
                    className="dish-input landing_placeholder"
                    placeholder="Enter dish name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>

                <div className="dish-form-group">
                  <label className="dish-label landing_body">Pricing</label>
                  <div className="pricing-input-wrapper">
                    <input
                      type="number"
                      className="dish-input pricing-input landing_placeholder"
                      placeholder="0"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      required
                    />
                    <span className="currency-symbol landing_body">₹</span>
                  </div>
                  <span className="pricing-helper landing_body">You can change the currency symbol at the restaurant setting page</span>
                </div>
              </div>

              {/* Row 2: Availability & Dish type */}
              <div className="dish-form-grid-row" style={{ marginTop: '24px' }}>
                <div className="dish-form-group">
                  <label className="dish-label">Availability</label>
                  <div className="availability-checkbox-group">
                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={availBreakfast}
                        onChange={(e) => setAvailBreakfast(e.target.checked)}
                        className="offer-row-checkbox"
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Breakfast</span>
                    </label>

                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={availDinner}
                        onChange={(e) => setAvailDinner(e.target.checked)}
                        className="offer-row-checkbox"
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Dinner</span>
                    </label>

                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={availLunch}
                        onChange={(e) => setAvailLunch(e.target.checked)}
                        className="offer-row-checkbox"
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Lunch</span>
                    </label>
                  </div>
                </div>

                <div className="dish-form-group">
                  <label className="dish-label">Dish type</label>
                  <div className="dish-type-radio-group">
                    <label className="dish-radio-label">
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Veg</span>
                      <input
                        type="radio"
                        name="dishType"
                        checked={newItemIsVeg === true}
                        onChange={() => setNewItemIsVeg(true)}
                        className="dish-radio-input"
                      />
                      <span className="dish-radio-dot"></span>
                    </label>

                    <label className="dish-radio-label" style={{ marginLeft: '12px' }}>
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Non Veg</span>
                      <input
                        type="radio"
                        name="dishType"
                        checked={newItemIsVeg === false}
                        onChange={() => setNewItemIsVeg(false)}
                        className="dish-radio-input"
                      />
                      <span className="dish-radio-dot"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 3: Upload image & Category select */}
              <div className="dish-form-grid-row" style={{ marginTop: '24px' }}>
                <div className="dish-form-group">
                  <span className="dish-label">Dish image</span>
                  <DishImageField
                    previewSrc={newItemImage}
                    dishName={newItemName}
                    onSelectFile={handleNewImageFile}
                    onPickUrl={handleNewImagePickUrl}
                    onRemove={handleNewImageRemove}
                  />
                </div>

                <div className="dish-form-group">
                  <label className="dish-label">Category</label>
                  <select
                    className="dish-select"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer Save & Cancel Buttons */}
              <div className="dish-modal-footer menu-sticky-footer">
                <button type="submit" className="btn-save-dish">Save dish</button>
                <button type="button" className="btn-cancel-dish" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dish Details Modal */}
      {isDetailsModalOpen && selectedDish && (
        <div className="modal-overlay" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="modal-content dish-modal-content dish-details-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header dish-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title dish-modal-title landing_heading2">Dish details</h3>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="modal-close-icon-btn"
                title="Close"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="dish-details-body">
              {/* Dish Visual & Basic Meta */}
              <div className="dish-details-meta-row">
                <div className="dish-details-img-wrapper">
                  <img
                    src={getImageUrl(selectedDish.image)}
                    alt={selectedDish.name}
                    className="dish-details-img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                </div>

                <div className="dish-details-info">
                  <div className="dish-details-badge-row">
                    <div className={`veg-box ${!selectedDish.isVeg ? 'non-veg' : ''}`}>
                      <div className={`veg-dot ${!selectedDish.isVeg ? 'non-veg' : ''}`}></div>
                    </div>
                    <span style={{ fontSize: 'var(--caption-size)', fontWeight: 'var(--weight-semibold)', color: selectedDish.isVeg ? '#16a34a' : '#dc2626' }}>
                      {selectedDish.isVeg ? 'Veg' : 'Non Veg'}
                    </span>
                    {selectedDishCategory?.name && (
                      <span className="dish-details-category-tag">
                        {selectedDishCategory.name}
                      </span>
                    )}
                  </div>

                  <h2 className="landing_heading2 dish-details-name">
                    {selectedDish.name}
                  </h2>

                  <p className="dish-details-price">
                    ₹{selectedDish.price}
                  </p>

                  {/* Availability Badges */}
                  <div className="dish-details-avail-group">
                    <span className="dish-details-avail-label">
                      Availability:
                    </span>
                    <span className={`dish-avail-badge${isFlagSet(selectedDish.availableBreakfast) ? ' is-available' : ''}`}>
                      Breakfast
                    </span>
                    <span className={`dish-avail-badge${isFlagSet(selectedDish.availableLunch) ? ' is-available' : ''}`}>
                      Lunch
                    </span>
                    <span className={`dish-avail-badge${isFlagSet(selectedDish.availableDinner) ? ' is-available' : ''}`}>
                      Dinner
                    </span>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="dish-details-desc-box">
                <span className="dish-details-desc-label">
                  Description
                </span>
                <p className="dish-details-desc-text" style={{ fontStyle: selectedDish.description ? 'normal' : 'italic' }}>
                  {selectedDish.description || 'No description provided for this dish.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="dish-details-actions">
                <button
                  type="button"
                  className="btn-save-dish"
                  onClick={() => handleOpenEditModal(selectedDish, selectedDishCategory)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit dish
                </button>
                <button
                  type="button"
                  className="btn-cancel-dish"
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dish Modal */}
      {isEditModalOpen && selectedDish && (
        <div className="modal-overlay" onClick={() => !editLoading && setIsEditModalOpen(false)}>
          <div className="modal-content dish-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header dish-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title dish-modal-title landing_heading2">Edit dish</h3>
              <button
                type="button"
                onClick={() => !editLoading && setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                disabled={editLoading}
                title="Close"
                aria-label="Close edit modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditDishSubmit} className="dish-modal-form">
              {editError && (
                <div className="dish-form-error-banner" style={{ padding: '10px 14px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#b91c1c', fontSize: 'var(--caption-size)', marginBottom: '16px' }}>
                  {editError}
                </div>
              )}

              {/* Row 1: Dish name & Pricing */}
              <div className="dish-form-grid-row">
                <div className="dish-form-group">
                  <label className="dish-label landing_body">Dish name *</label>
                  <input
                    type="text"
                    className="dish-input landing_placeholder"
                    placeholder="Enter dish name"
                    value={editDishName}
                    onChange={(e) => setEditDishName(e.target.value)}
                    required
                    disabled={editLoading}
                  />
                </div>

                <div className="dish-form-group">
                  <label className="dish-label landing_body">Pricing *</label>
                  <div className="pricing-input-wrapper">
                    <input
                      type="number"
                      step="any"
                      className="dish-input pricing-input landing_placeholder"
                      placeholder="0"
                      value={editDishPrice}
                      onChange={(e) => setEditDishPrice(e.target.value)}
                      required
                      disabled={editLoading}
                    />
                    <span className="currency-symbol landing_body">₹</span>
                  </div>
                  <span className="pricing-helper landing_body">Price in restaurant currency</span>
                </div>
              </div>

              {/* Row 2: Description */}
              <div className="dish-form-group" style={{ marginTop: '20px' }}>
                <label className="dish-label landing_body">Description</label>
                <textarea
                  className="dish-input landing_placeholder"
                  placeholder="Describe the dish ingredients, preparation, taste..."
                  value={editDishDescription}
                  onChange={(e) => setEditDishDescription(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '68px', fontFamily: 'inherit' }}
                  disabled={editLoading}
                />
              </div>

              {/* Row 3: Availability & Dish type */}
              <div className="dish-form-grid-row" style={{ marginTop: '20px' }}>
                <div className="dish-form-group">
                  <label className="dish-label">Availability</label>
                  <div className="availability-checkbox-group">
                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={editAvailBreakfast}
                        onChange={(e) => setEditAvailBreakfast(e.target.checked)}
                        className="offer-row-checkbox"
                        disabled={editLoading}
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Breakfast</span>
                    </label>

                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={editAvailLunch}
                        onChange={(e) => setEditAvailLunch(e.target.checked)}
                        className="offer-row-checkbox"
                        disabled={editLoading}
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Lunch</span>
                    </label>

                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={editAvailDinner}
                        onChange={(e) => setEditAvailDinner(e.target.checked)}
                        className="offer-row-checkbox"
                        disabled={editLoading}
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Dinner</span>
                    </label>
                  </div>
                </div>

                <div className="dish-form-group">
                  <label className="dish-label">Dish type</label>
                  <div className="dish-type-radio-group">
                    <label className="dish-radio-label">
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Veg</span>
                      <input
                        type="radio"
                        name="editDishType"
                        checked={editDishIsVeg === true}
                        onChange={() => setEditDishIsVeg(true)}
                        className="dish-radio-input"
                        disabled={editLoading}
                      />
                      <span className="dish-radio-dot"></span>
                    </label>

                    <label className="dish-radio-label" style={{ marginLeft: '12px' }}>
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Non Veg</span>
                      <input
                        type="radio"
                        name="editDishType"
                        checked={editDishIsVeg === false}
                        onChange={() => setEditDishIsVeg(false)}
                        className="dish-radio-input"
                        disabled={editLoading}
                      />
                      <span className="dish-radio-dot"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 4: Upload image & Category select */}
              <div className="dish-form-grid-row" style={{ marginTop: '20px' }}>
                <div className="dish-form-group">
                  <span className="dish-label">Dish image</span>
                  <DishImageField
                    previewSrc={editDishImage}
                    dishName={editDishName}
                    disabled={editLoading}
                    onSelectFile={handleEditImageFile}
                    onPickUrl={handleEditImagePickUrl}
                    onRemove={handleEditImageRemove}
                  />
                </div>

                <div className="dish-form-group">
                  <label className="dish-label">Category *</label>
                  <select
                    className="dish-select"
                    value={editDishCategory}
                    onChange={(e) => setEditDishCategory(e.target.value)}
                    disabled={editLoading}
                    required
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer Save & Cancel Buttons (the only action bar in the edit form) */}
              <div className="dish-modal-footer menu-sticky-footer">
                <button type="submit" className="btn-save-dish" disabled={editLoading}>
                  {editLoading ? 'Saving changes...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-dish"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    // Grid view reaches Edit via Dish details, so Cancel returns there;
                    // list view opens Edit directly and should just close.
                    if (viewMode !== 'list') setIsDetailsModalOpen(true);
                  }}
                  disabled={editLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="category-modal-content">
            <div className="category-modal-header">
              <h3 className="category-modal-title">Create category</h3>
            </div>

            <form onSubmit={handleAddCategorySubmit} className="category-modal-form">
              <div className="category-form-group">
                <label className="category-label">Category name</label>
                <input
                  type="text"
                  className="category-input"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  required
                />
              </div>

              <div className="category-modal-footer">
                <button type="submit" className="btn-create-category">Create</button>
                <button type="button" className="btn-cancel-category" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <MenuImportDialog
          categories={categories}
          setCategories={setCategories}
          onClose={closeImportModal}
          onMenuChanged={broadcastMenuUpdate}
        />
      )}

      {/* Delete Category Confirmation */}
      {categoryToDelete && (
        <div className="modal-overlay menu-confirm-overlay" onClick={handleCancelDeleteCategory}>
          <div
            className="category-modal-content"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            aria-describedby="delete-category-desc"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancelDeleteCategory();
            }}
          >
            <div className="category-modal-header">
              <h3 id="delete-category-title" className="category-modal-title">Delete category?</h3>
            </div>

            <div className="menu-confirm-body">
              <p id="delete-category-desc" className="menu-confirm-text">
                Are you sure you want to delete <strong>"{categoryToDelete.name}"</strong>?
              </p>
              <div className={`menu-confirm-warning${backupMode === 'on' && categoryToDelete.dishCount > 0 ? ' is-recoverable' : ''}`}>
                <WarningIcon />
                <span>
                  {categoryToDelete.dishCount === 0
                    ? "This category has no dishes. This can't be undone."
                    : backupMode === 'on'
                      ? `The ${dishCountText(categoryToDelete.dishCount)} in this category will be moved to Trash. You can restore them for ${dishBackup.retentionDays} days. Restoring a dish also brings this category back.`
                      : backupMode === 'off'
                        ? `The ${dishCountText(categoryToDelete.dishCount)} in this category will be permanently deleted. This can't be undone.`
                        : `This will also permanently delete the ${dishCountText(categoryToDelete.dishCount)} in this category. This can't be undone.`}
                </span>
              </div>

              <div className="category-modal-footer">
                <button
                  type="button"
                  className="btn-create-category menu-btn-danger"
                  onClick={handleConfirmDeleteCategory}
                  disabled={isDeletingCategory}
                >
                  {isDeletingCategory ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-category"
                  onClick={handleCancelDeleteCategory}
                  disabled={isDeletingCategory}
                  autoFocus
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Dishes Confirmation */}
      {isDeleteDishesOpen && (
        <div className="modal-overlay menu-confirm-overlay" onClick={handleCancelDeleteDishes}>
          <div
            className="category-modal-content"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dishes-title"
            aria-describedby="delete-dishes-desc"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancelDeleteDishes();
            }}
          >
            <div className="category-modal-header">
              <h3 id="delete-dishes-title" className="category-modal-title">
                Delete {selectedDishIds.length === 1 ? 'dish' : 'dishes'}?
              </h3>
            </div>

            <div className="menu-confirm-body">
              <p id="delete-dishes-desc" className="menu-confirm-text">
                {backupMode === 'unavailable'
                  ? `Are you sure you want to delete the ${selectedDishIds.length} selected dishes?`
                  : `Are you sure you want to delete the ${selectedDishIds.length} selected ${selectedDishIds.length === 1 ? 'dish' : 'dishes'}?`}
              </p>
              {backupMode !== 'unavailable' && (
                <div className={`menu-confirm-warning${backupMode === 'on' ? ' is-recoverable' : ''}`}>
                  <WarningIcon />
                  <span>
                    {backupMode === 'on'
                      ? `The selected ${selectedDishIds.length === 1 ? 'dish' : 'dishes'} will be moved to Trash. You can restore ${selectedDishIds.length === 1 ? 'it' : 'them'} for ${dishBackup.retentionDays} days.`
                      : `The selected ${selectedDishIds.length === 1 ? 'dish' : 'dishes'} will be permanently deleted. This can't be undone.`}
                  </span>
                </div>
              )}

              <div className="category-modal-footer">
                <button
                  type="button"
                  className="btn-create-category menu-btn-danger"
                  onClick={handleDeleteSelectedDishes}
                  disabled={isDeletingDishes}
                >
                  {isDeletingDishes ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-category"
                  onClick={handleCancelDeleteDishes}
                  disabled={isDeletingDishes}
                  autoFocus
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTrashOpen && (
        <TrashDialog
          onClose={closeTrash}
          onChanged={handleTrashChanged}
          backupEnabled={backupMode === 'on'}
          retentionDays={dishBackup.retentionDays}
        />
      )}

      {/* Delete All Confirmation */}
      {isDeleteAllOpen && (
        <div className="modal-overlay menu-confirm-overlay" onClick={handleCancelDeleteAll}>
          <div
            className="category-modal-content"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-all-title"
            aria-describedby="delete-all-desc"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancelDeleteAll();
            }}
          >
            <div className="category-modal-header">
              <h3 id="delete-all-title" className="category-modal-title">Delete entire menu?</h3>
            </div>

            <div className="menu-confirm-body">
              <p id="delete-all-desc" className="menu-confirm-text">
                Are you sure you want to delete <strong>your whole menu</strong>?
              </p>
              <div className={`menu-confirm-warning${backupMode === 'on' ? ' is-recoverable' : ''}`}>
                <WarningIcon />
                {backupMode === 'unavailable' ? (
                  <span>
                    This will permanently delete all {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} and{' '}
                    {totalDishCount} dish(es), along with their
                    uploaded photos. This can't be undone.
                  </span>
                ) : backupMode === 'on' ? (
                  <span>
                    All {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} will be deleted and the{' '}
                    {dishCountText(totalDishCount)} will be moved to Trash. You can restore them for{' '}
                    {dishBackup.retentionDays} days. Restoring a dish also brings its category back.
                  </span>
                ) : (
                  <span>
                    All {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} and{' '}
                    {dishCountText(totalDishCount)} will be permanently deleted, along with their
                    uploaded photos. This can't be undone.
                  </span>
                )}
              </div>

              <div className="category-modal-footer">
                <button
                  type="button"
                  className="btn-create-category menu-btn-danger"
                  onClick={handleConfirmDeleteAll}
                  disabled={isDeletingAll}
                >
                  {isDeletingAll ? 'Deleting…' : 'Delete everything'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-category"
                  onClick={handleCancelDeleteAll}
                  disabled={isDeletingAll}
                  autoFocus
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Filter Modal Dialog */}
      {isFilterModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFilterModalOpen(false)}>
          <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3 className="filter-modal-title">Filter</h3>
            </div>

            <div className="filter-modal-body">
              <form onSubmit={handleApplyFilters}>
                {/* Category Dropdown */}
                <div className="filter-group">
                  <label className="filter-label">Category</label>
                  <div className="filter-select-wrapper">
                    <select 
                      className="filter-select"
                      value={tempFilterCategory}
                      onChange={(e) => setTempFilterCategory(e.target.value)}
                    >
                      <option value="all">Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Availability Checkboxes */}
                <div className="filter-group" style={{ marginTop: '20px' }}>
                  <label className="filter-label">Availability</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="checkbox" 
                        className="filter-checkbox-input"
                        checked={tempFilterAvailability.Breakfast}
                        onChange={(e) => setTempFilterAvailability(prev => ({ ...prev, Breakfast: e.target.checked }))}
                      />
                      Breakfast
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="checkbox" 
                        className="filter-checkbox-input"
                        checked={tempFilterAvailability.Dinner}
                        onChange={(e) => setTempFilterAvailability(prev => ({ ...prev, Dinner: e.target.checked }))}
                      />
                      Dinner
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="checkbox" 
                        className="filter-checkbox-input"
                        checked={tempFilterAvailability.Lunch}
                        onChange={(e) => setTempFilterAvailability(prev => ({ ...prev, Lunch: e.target.checked }))}
                      />
                      Lunch
                    </label>
                  </div>
                </div>

                {/* Dish Type Radios */}
                <div className="filter-group" style={{ marginTop: '20px' }}>
                  <label className="filter-label">Dish type</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="radio" 
                        name="dishType"
                        className="filter-radio-input"
                        checked={tempFilterDishType === 'veg'}
                        onChange={() => setTempFilterDishType('veg')}
                      />
                      Veg
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="radio" 
                        name="dishType"
                        className="filter-radio-input"
                        checked={tempFilterDishType === 'non-veg'}
                        onChange={() => setTempFilterDishType('non-veg')}
                      />
                      Non Veg
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="radio" 
                        name="dishType"
                        className="filter-radio-input"
                        checked={tempFilterDishType === 'all'}
                        onChange={() => setTempFilterDishType('all')}
                      />
                      All
                    </label>
                  </div>
                </div>

                {/* Buttons Row */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button type="submit" className="filter-submit-btn">Filter</button>
                  <button type="button" className="filter-cancel-btn" onClick={() => setIsFilterModalOpen(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MenuList;
