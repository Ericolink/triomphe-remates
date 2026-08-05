import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createObjectUrlCache } from '../utils/objectUrlCache';

// Deriva previews { file, url } para un arreglo de File, creando Object URLs solo para
// archivos nuevos y revocando las de archivos que salieron del arreglo. Al desmontar,
// revoca cualquier URL que haya quedado viva.
export default function useFilePreviews(files) {
  const [previews, setPreviews] = useState([]);
  const cacheRef = useRef(null);
  if (cacheRef.current === null) {
    cacheRef.current = createObjectUrlCache();
  }

  useLayoutEffect(() => {
    setPreviews(cacheRef.current.sync(files));
  }, [files]);

  useEffect(() => () => cacheRef.current.clear(), []);

  return previews;
}
