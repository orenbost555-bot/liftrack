// ספריית התרגילים. נלקחה מהעיצוב (Library) והיא מקור האמת של האפליקציה.
// מבנה: קבוצת שריר -> תת-שריר -> תרגילים.
// בכל תרגיל:
//   id   מזהה קבוע (נשמר באימונים, לכן לא משנים אותו אחרי שמתחילים להשתמש)
//   he/en שם ותיאור קצר
//   p    שרירים עיקריים (מפתחות מהמפה: chestUpper, lats, quads ...)
//   sec  שרירים משניים
//   bw   true = תרגיל במשקל גוף, לא נכלל בנפח האימון

const ex = (id, he, en, p, sec = [], bw = false) => ({ id, he, en, p, sec, bw });

export const LIBRARY = [
  {
    id: "chest",
    name: "חזה",
    subs: [
      {
        name: "חזה עליון",
        ex: [
          ex("incline_press", "לחיצת חזה בשיפוע חיובי", "Incline Bench Press · מוט או משקולות", ["chestUpper"], ["antDelt", "triceps"]),
          ex("incline_fly", "פרפר בשיפוע חיובי עם משקולות", "Incline Dumbbell Flyes", ["chestUpper"], ["antDelt"]),
          ex("cable_cross_up", "קרוסאובר מכבל תחתון כלפי מעלה", "Low-to-High Cable Crossover", ["chestUpper"], ["antDelt"]),
          ex("decline_pushup", "שכיבות סמיכה בשיפוע שלילי", "רגליים מוגבהות על ספסל", ["chestUpper"], ["antDelt", "triceps"], true),
        ],
      },
      {
        name: "חזה אמצעי",
        ex: [
          ex("flat_press", "לחיצת חזה בשכיבה", "Flat Bench Press · מוט או משקולות", ["chestMid"], ["chestUpper", "chestLower", "antDelt", "triceps"]),
          ex("flat_fly", "פרפר בשכיבה", "Flat Dumbbell Flyes", ["chestMid"], ["antDelt"]),
          ex("pec_deck", "פלייס במכונה", "Pec Deck Machine", ["chestMid"], ["antDelt"]),
          ex("pushup", "שכיבות סמיכה קלאסיות", "Push-ups", ["chestMid"], ["antDelt", "triceps", "rectus"], true),
          ex("chest_machine", "לחיצת חזה במכונה ייעודית", "Chest Press Machine", ["chestMid"], ["antDelt", "triceps"]),
        ],
      },
      {
        name: "חזה תחתון",
        ex: [
          ex("decline_press", "לחיצת חזה בשיפוע שלילי", "Decline Bench Press", ["chestLower"], ["antDelt", "triceps"]),
          ex("dips_wide", "מקבילים באחיזה רחבה", "Dips · עם רכינה קלה קדימה", ["chestLower"], ["antDelt", "triceps"], true),
          ex("cable_cross_down", "קרוסאובר מכבל עליון כלפי מטה", "High-to-Low Cable Crossover", ["chestLower"], ["antDelt"]),
        ],
      },
    ],
  },
  {
    id: "back",
    name: "גב",
    subs: [
      {
        name: "רחב גבי",
        ex: [
          // מתח: כל אחיזה היא תרגיל נפרד, כי האחיזה משנה אילו שרירים עובדים יותר.
          // pullups נשאר עם אותו id (אחיזה רגילה) כדי שהיסטוריה קיימת לא תיפגע.
          ex("pullups", "עליות מתח באחיזה רגילה", "Pull-ups · כף יד קדימה, ברוחב כתפיים", ["lats"], ["rhomboids", "biceps", "forearms"], true),
          ex("pullups_wide", "עליות מתח באחיזה רחבה", "Wide-Grip Pull-ups · רחב מהכתפיים, דגש על רחב הגב", ["lats"], ["rhomboids", "postDelt", "biceps", "forearms"], true),
          ex("pullups_close", "עליות מתח באחיזה צרה", "Close-Grip Pull-ups · ידיים קרובות, יותר יד קדמית", ["lats", "biceps"], ["rhomboids", "forearms"], true),
          ex("pullups_neutral", "עליות מתח באחיזה ניטרלית", "Neutral-Grip Pull-ups · כפות הידיים זו מול זו", ["lats", "biceps"], ["rhomboids", "forearms"], true),
          ex("lat_pulldown", "משיכת פולי עליון", "Lat Pulldown · אחיזה רחבה, צרה או הפוכה", ["lats"], ["rhomboids", "biceps"]),
          ex("bent_row", "חתירה בהטיית גוף", "Bent-over Rows · מוט או משקולות", ["lats", "rhomboids"], ["erectors", "postDelt", "biceps"]),
          ex("seated_row", "חתירה בפולי תחתון", "Seated Cable Rows", ["lats"], ["rhomboids", "biceps"]),
          ex("tbar", "חתירת T-Bar", "T-Bar Row", ["lats", "rhomboids"], ["erectors", "biceps"]),
          ex("pullover", "פולאובר", "Pullovers · כבלים או משקולת בודדת", ["lats"], ["chestMid", "triceps"]),
        ],
      },
      {
        name: "טרפזים",
        ex: [
          ex("shrugs", "משיכת כתפיים", "Shrugs · משקולות, מוט או מכונה", ["traps"], ["forearms"]),
          ex("face_pull", "משיכת פנים בכבל", "Face Pulls · טרפז אמצעי ותחתון", ["traps", "postDelt"], ["rhomboids"]),
          ex("upright_wide", "חתירה זקופה באחיזה רחבה", "Upright Row", ["traps", "latDelt"], ["biceps"]),
        ],
      },
      {
        name: "זוקפי הגב",
        ex: [
          ex("back_ext", "פשיטת גו בכיסא רומי", "Back Extensions", ["erectors"], ["glutes", "hamstrings"], true),
          ex("deadlift", "דדליפט קלאסי", "Deadlift", ["erectors", "glutes", "hamstrings"], ["traps", "lats", "quads", "forearms"]),
          ex("good_morning", "גוד מורנינג", "Good Mornings", ["erectors", "hamstrings"], ["glutes"]),
          ex("superman", "סופרמן", "על מזרן", ["erectors"], ["glutes"], true),
        ],
      },
      {
        name: "מעוינים",
        ex: [
          ex("pendlay", "חתירה באחיזה רחבה מקבילה לרצפה", "Pendlay Rows", ["rhomboids", "lats"], ["erectors", "postDelt", "biceps"]),
          ex("reverse_fly", "פרפר הפוך", "משלב גם את הכתף האחורית", ["rhomboids", "postDelt"], ["traps"]),
        ],
      },
    ],
  },
  {
    id: "shoulders",
    name: "כתפיים",
    subs: [
      {
        name: "כתף קדמית",
        ex: [
          ex("ohp", "לחיצת כתפיים", "Overhead Press · עמידה או ישיבה", ["antDelt"], ["latDelt", "triceps", "traps"]),
          ex("arnold", "לחיצת ארנולד", "Arnold Press", ["antDelt", "latDelt"], ["triceps"]),
          ex("front_raise", "הרמות ידיים קדימה", "Front Raises · משקולות, כבל או צלחת", ["antDelt"], ["chestUpper"]),
        ],
      },
      {
        name: "כתף אמצעית",
        ex: [
          ex("lateral_raise", "הרמות ידיים לצדדים", "Lateral Raises · משקולות או כבלים", ["latDelt"], ["traps"]),
          ex("upright_narrow", "חתירה זקופה באחיזה צרה", "Upright Row", ["latDelt", "traps"], ["biceps"]),
          ex("lateral_machine", "הרמות לצדדים במכונה", "Lateral Raise Machine", ["latDelt"], []),
        ],
      },
      {
        name: "כתף אחורית",
        ex: [
          ex("rev_pec_deck", "פרפר הפוך במכונה", "Reverse Pec Deck", ["postDelt"], ["rhomboids", "traps"]),
          ex("bent_lateral", "הרמות לצדדים בהטיית גוף", "Bent-over Lateral Raises", ["postDelt"], ["rhomboids"]),
          ex("face_pull_post", "משיכת פנים", "Face Pulls", ["postDelt", "traps"], ["rhomboids"]),
        ],
      },
    ],
  },
  {
    id: "legs",
    name: "רגליים",
    subs: [
      {
        name: "ארבע ראשי",
        ex: [
          ex("squat", "סקוואט", "Squat · קלאסי, קדמי או גובלט", ["quads", "glutes"], ["hamstrings", "erectors", "calves", "rectus"]),
          ex("leg_press", "לחיצת רגליים", "Leg Press · כפות רגליים נמוך", ["quads"], ["glutes", "calves"]),
          ex("leg_ext", "פשיטת ברכיים במכונה", "Leg Extensions", ["quads"], []),
          ex("lunges", "מכרעים", "Lunges · הליכה, במקום או לאחור", ["quads", "glutes"], ["hamstrings", "calves"]),
          ex("bulgarian", "ספליט סקוואט בולגרי", "Bulgarian Split Squat", ["quads", "glutes"], ["hamstrings"]),
          ex("hack", "האק סקוואט", "Hack Squat", ["quads"], ["glutes"]),
        ],
      },
      {
        name: "המסטרינגס",
        ex: [
          ex("rdl", "דדליפט רומני", "Romanian Deadlift", ["hamstrings", "glutes"], ["erectors"]),
          ex("lying_curl", "כפיפת ברכיים בשכיבה", "Lying Leg Curls", ["hamstrings"], ["calves"]),
          ex("seated_curl", "כפיפת ברכיים בישיבה", "Seated Leg Curls", ["hamstrings"], []),
          ex("ghr", "גלוט-האם רייז", "Glute-Ham Raises", ["hamstrings", "glutes"], ["erectors", "calves"]),
          ex("stiff_dl", "דדליפט רגליים ישרות", "Stiff-leg Deadlift", ["hamstrings"], ["glutes", "erectors"]),
        ],
      },
      {
        name: "ישבן",
        ex: [
          ex("hip_thrust", "דחיקת אגן", "Hip Thrusts · מוט או מכונה", ["glutes"], ["hamstrings", "quads"]),
          ex("glute_bridge", "גשר ישבן", "Glute Bridges", ["glutes"], ["hamstrings"], true),
          ex("glute_kickback", "קיקבאק לאחור בכבלים או במכונה", "Cable Glute Kickbacks", ["glutes"], ["hamstrings"]),
          ex("hip_abduction", "הרחקת ירכיים במכונה בישיבה", "Seated Hip Abduction", ["glutes"], []),
          ex("sumo", "סקוואט סומו", "Sumo Squat", ["glutes", "quads"], ["hamstrings"]),
        ],
      },
      {
        name: "תאומים וסוליה",
        ex: [
          ex("standing_calf", "הרמת עקבים בעמידה", "Standing Calf Raises · דגש על התאומים", ["calves"], []),
          ex("seated_calf", "הרמת עקבים בישיבה", "Seated Calf Raises · דגש על הסוליה", ["calves"], []),
          ex("press_calf", "הרמת עקבים בלחיצת רגליים", "Leg Press Calf Raises", ["calves"], []),
        ],
      },
    ],
  },
  {
    id: "biceps",
    name: "יד קדמית",
    subs: [
      {
        name: "יד קדמית",
        ex: [
          ex("bicep_curl", "כפיפת מרפקים בעמידה", "Bicep Curls · מוט ישר, מוט W או משקולות", ["biceps"], ["forearms"]),
          ex("hammer", "כפיפת פטישים", "Hammer Curls · עובד גם על הברכיאליס", ["biceps", "forearms"], []),
          ex("preacher", "כפיפת מרפקים בכיסא כומר", "Preacher Curls", ["biceps"], []),
          ex("cable_curl", "כפיפת מרפקים בכבל התחתון", "Cable Curls", ["biceps"], []),
          ex("chinups", "עליות מתח באחיזה הפוכה", "Chin-ups · כף יד אליך, דגש על יד קדמית", ["biceps", "lats"], ["forearms"], true),
          ex("concentration", "כפיפת מרפקים בריכוז בישיבה", "Concentration Curls", ["biceps"], []),
        ],
      },
    ],
  },
  {
    id: "triceps",
    name: "יד אחורית",
    subs: [
      {
        name: "יד אחורית",
        ex: [
          ex("pushdown", "פשיטת מרפקים בפולי עליון", "Tricep Pushdowns · חבל או מוט", ["triceps"], []),
          ex("close_grip", "לחיצת חזה באחיזה צרה", "Close-Grip Bench Press", ["triceps"], ["chestMid", "antDelt"]),
          ex("dips_narrow", "מקבילים באחיזה צרה", "Dips · גוף זקוף", ["triceps"], ["chestLower", "antDelt"], true),
          ex("skull", "לחיצה צרפתית", "Skull Crushers · מוט W בשכיבה", ["triceps"], []),
          ex("overhead_ext", "פשיטת מרפק מאחורי הראש", "Overhead Tricep Extensions", ["triceps"], []),
          ex("tri_kickback", "קיקבאק ליד אחורית", "Tricep Kickbacks · משקולות או כבל", ["triceps"], ["postDelt"]),
        ],
      },
    ],
  },
  {
    id: "abs",
    name: "בטן",
    subs: [
      {
        name: "ישר בטני",
        ex: [
          ex("crunch", "כפיפות בטן", "Crunches", ["rectus"], [], true),
          ex("hanging_raise", "הרמות רגליים או ברכיים בתלייה", "Hanging Leg Raises", ["rectus"], ["obliques", "forearms"], true),
          ex("lying_raise", "הרמת רגליים בשכיבה", "Lying Leg Raises", ["rectus"], [], true),
          ex("cable_crunch", "כפיפות בטן בפולי עליון", "Cable Crunches", ["rectus"], []),
          ex("ab_wheel", "גלגל בטן", "Ab Wheel Rollout", ["rectus"], ["obliques", "lats"], true),
          ex("plank", "פלאנק", "Plank", ["rectus"], ["obliques", "erectors"], true),
        ],
      },
      {
        name: "אלכסונים",
        ex: [
          ex("russian", "טוויסט רוסי", "Russian Twists · עם או בלי משקל", ["obliques"], ["rectus"], true),
          ex("bicycle", "אופניים", "Bicycle Crunches", ["obliques", "rectus"], [], true),
          ex("side_bend", "כפיפת גו הצידה", "Side Bends · משקולת או כבל", ["obliques"], []),
          ex("side_plank", "פלאנק צדי", "Side Plank", ["obliques"], ["latDelt"], true),
          ex("woodchop", "רוטציות בכבלים", "Cable Woodchoppers", ["obliques"], ["rectus", "antDelt"]),
        ],
      },
    ],
  },
  {
    id: "forearms",
    name: "אמות",
    subs: [
      {
        name: "אמות",
        ex: [
          ex("wrist_curl", "כפיפת שורש כף היד", "Wrist Curls · כפות ידיים כלפי מעלה", ["forearms"], []),
          ex("reverse_wrist", "פשיטת שורש כף היד", "Reverse Wrist Curls · כפות ידיים כלפי מטה", ["forearms"], []),
          ex("dead_hang", "תלייה סטטית על מתח", "Dead Hangs", ["forearms"], ["lats"], true),
          ex("farmer", "הליכת איכר", "Farmer Walk · נשיאת משקולות כבדות", ["forearms"], ["traps", "erectors"]),
          ex("reverse_curl", "כפיפת מרפקים באחיזה הפוכה", "Reverse Bicep Curls", ["forearms"], ["biceps"]),
          ex("wrist_roller", "גלגול משקולת קשורה לחבל", "Wrist Roller", ["forearms"], []),
        ],
      },
    ],
  },
];
