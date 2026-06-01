import { Router }       from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  listCards, getCard, createCard, updateCard, deactivateCard,
} from './cards.controller';

// @ts-ignore
const router: any = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/v1/cards?active=true  — cualquier usuario autenticado puede listar (para el formulario de gasto)
router.get('/',     listCards);
router.get('/:id',  getCard);

// Solo admins pueden crear, editar y desactivar
router.post('/',           authorize('admin'), createCard);
router.put('/:id',         authorize('admin'), updateCard);
router.delete('/:id',      authorize('admin'), deactivateCard);

export default router;
