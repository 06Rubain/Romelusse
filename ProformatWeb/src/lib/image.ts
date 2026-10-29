// Lit une image choisie par l'utilisateur et la réduit si besoin (logos stockés en data URL)
export const readImageFile = (file: File, maxWidth = 800): Promise<string> => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    reject(new Error('Formats acceptés : PNG, JPEG ou WebP.'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Image illisible.'));
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      // PNG conserve la transparence des logos
      resolve(canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9));
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});
