# PicToBrix v2

הפכו כל תמונה לתמונת בריקס — עורך חי, הדמיה על קיר, ו-PDF הוראות הרכבה שנוצר כולו בדפדפן.

## מה יש כאן
- `src/components/Editor.jsx` — העורך הראשי: העלאת תמונה, חיתוך (זום/מיקום), בהירות/ניגודיות/רוויה, דיטרינג, ביטול צבעים, סטטיסטיקות
- `src/components/RoomScene.jsx` — הדמיה על קיר ב-5 חדרים בקנה מידה אמיתי
- `src/lib/palette.js` — פלטת 40 הצבעים הרשמית
- `src/lib/bricks.js` — קוונטיזציה (Floyd-Steinberg) ורינדור בריקס
- `src/lib/pdf.js` — יצירת PDF הוראות A3 בדפדפן (קל פי ~5 מהמערכת הישנה)
- `public/assets/` — לוגו, 40 אייקוני צבע, 40 טקסטורות בריקס

## הרצה מקומית
```bash
npm install
npm run dev
```

## פריסה ל-Vercel
1. דחפו את הריפו ל-GitHub (ריפו פרטי!)
2. ב-Vercel: Add New Project → Import → בחרו את הריפו
3. Vercel מזהה Vite אוטומטית — Deploy

## שלבים הבאים (עוד לא בקוד)
- Supabase: שמירת פרויקטים והזמנות (מפתחות דרך Environment Variables ב-Vercel)
- PayPlus: תשלום לפני הורדת ה-PDF
- החלפת איורי החדרים בצילומי חדרים אמיתיים (`RoomScene.jsx`)
- מצלמה חיה להדמיה על הקיר של הלקוח (getUserMedia — עובד רק ב-HTTPS)
