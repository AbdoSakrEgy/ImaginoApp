import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware';
import { GalleryServices } from './gallery.service';
import { multerUpload, StoreInEnum } from '../../utils/multer/multer.upload';

const router = Router();
const galleryServices = new GalleryServices();

const upload = multerUpload({
    sendedFileDest: 'Gallery',
    sendedFileType: ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    storeIn: StoreInEnum.disk,
});


router.post(
    '/upload',
    auth, 
    upload.array('image', 3), 
    galleryServices.uploadGallery
);

export default router;
