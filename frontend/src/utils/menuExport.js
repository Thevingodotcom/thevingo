/**
 * Downloadable copies of the menu: Excel (.xlsx), PDF and PNG image.
 *
 * The PDF and the image share one canvas renderer, so they look the same and
 * render any script (Tamil, Hindi, ₹ ...) through the browser's own fonts -
 * jsPDF's built-in fonts only cover Latin-1. The Excel file is the menu
 * import workbook (same columns and dropdowns), so it can be imported back.
 *
 * exceljs and jspdf are loaded on demand to keep them out of the main bundle.
 */
import { downloadBlob } from './download';
import { buildMenuWorkbookBlob } from './menuImportExcel';

export const MENU_EXPORT_FORMATS = ['excel', 'pdf', 'image'];

const MEAL_SLOTS = [
  { key: 'availableBreakfast', label: 'Breakfast' },
  { key: 'availableLunch', label: 'Lunch' },
  { key: 'availableDinner', label: 'Dinner' }
];

// Flags arrive as booleans, 0/1 or 'true'/'false' depending on the source.
const isFlagSet = (value) => value === true || value === 1 || value === 'true';

const exportableCategories = (categories) =>
  (categories || []).filter(category => Array.isArray(category.items) && category.items.length > 0);

export const hasExportableDishes = (categories) => exportableCategories(categories).length > 0;

export const getMenuExportFileName = (restaurantName, extension) => {
  const slug = String(restaurantName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug ? `${slug}-` : ''}menu.${extension}`;
};

const formatPrice = (price) => {
  const text = String(price ?? '').trim();
  return text ? `₹${text}` : '';
};

const availableSlotLabels = (item) => MEAL_SLOTS.filter(slot => isFlagSet(item[slot.key])).map(slot => slot.label);

/** One object per dish, keyed by the menu import column keys. */
export const buildMenuSheetRows = (categories) =>
  exportableCategories(categories).flatMap(category =>
    category.items.map(item => {
      const price = Number(item.price);
      return {
        category: category.name || '',
        name: item.name || '',
        price: item.price !== '' && Number.isFinite(price) ? price : (item.price ?? ''),
        vegType: isFlagSet(item.isVeg) ? 'Veg' : 'Non Veg',
        breakfast: isFlagSet(item.availableBreakfast) ? 'Yes' : 'No',
        lunch: isFlagSet(item.availableLunch) ? 'Yes' : 'No',
        dinner: isFlagSet(item.availableDinner) ? 'Yes' : 'No',
        description: item.description || ''
      };
    })
  );

/* ---------- Excel ---------- */

async function exportExcel(menu) {
  const blob = await buildMenuWorkbookBlob({
    rows: buildMenuSheetRows(menu.categories),
    existingCategories: (menu.categories || []).map(category => category.name)
  });
  downloadBlob(blob, getMenuExportFileName(menu.restaurantName, 'xlsx'));
}

/* ---------- Menu card renderer (PDF + image) ---------- */

// Layout units are PDF points; A4 is 595 x 842. The image uses the same width.
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PDF_FOOTER_HEIGHT = 16;
const DISH_TEXT_INDENT = 18;

const FONT_STACK = '"Inter", "Segoe UI", "Noto Sans", system-ui, sans-serif';
const font = (size, weight = 400) => `${weight} ${size}px ${FONT_STACK}`;

const COLORS = {
  background: '#ffffff',
  primary: '#f05a28',
  text: '#1f2937',
  muted: '#6b7280',
  rule: '#e5e7eb',
  veg: '#16a34a',
  nonVeg: '#dc2626',
  available: '#059669'
};

const wrapText = (ctx, text, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
};

const createCanvas = (width, height, scale) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top';
  return { canvas, ctx };
};

function headerBlock(ctx, { restaurantName, tagline, address }) {
  ctx.font = font(26, 700);
  const titleLines = wrapText(ctx, restaurantName || 'Menu', CONTENT_WIDTH);
  ctx.font = font(13);
  const taglineLines = wrapText(ctx, tagline, CONTENT_WIDTH);
  ctx.font = font(11);
  const addressLines = wrapText(ctx, address, CONTENT_WIDTH);

  const height = titleLines.length * 32
    + (taglineLines.length ? 4 + taglineLines.length * 18 : 0)
    + (addressLines.length ? 4 + addressLines.length * 15 : 0)
    + 14 + 3 + 12;

  return {
    height,
    draw(c, top) {
      const cx = PAGE_WIDTH / 2;
      let y = top;
      c.textAlign = 'center';
      c.fillStyle = COLORS.text;
      c.font = font(26, 700);
      titleLines.forEach(line => { c.fillText(line, cx, y); y += 32; });
      if (taglineLines.length) {
        y += 4;
        c.fillStyle = COLORS.muted;
        c.font = font(13);
        taglineLines.forEach(line => { c.fillText(line, cx, y); y += 18; });
      }
      if (addressLines.length) {
        y += 4;
        c.fillStyle = COLORS.muted;
        c.font = font(11);
        addressLines.forEach(line => { c.fillText(line, cx, y); y += 15; });
      }
      y += 14;
      c.fillStyle = COLORS.primary;
      c.fillRect(cx - 30, y, 60, 3);
      c.textAlign = 'left';
    }
  };
}

function categoryBlock(ctx, category) {
  ctx.font = font(17, 700);
  const lines = wrapText(ctx, category.name || 'Menu', CONTENT_WIDTH);
  return {
    height: 18 + lines.length * 22 + 6 + 1 + 6,
    keepWithNext: true,
    draw(c, top) {
      let y = top + 18;
      c.fillStyle = COLORS.primary;
      c.font = font(17, 700);
      lines.forEach(line => { c.fillText(line, MARGIN, y); y += 22; });
      c.fillStyle = COLORS.rule;
      c.fillRect(MARGIN, y + 6, CONTENT_WIDTH, 1);
    }
  };
}

function dishBlock(ctx, item) {
  const priceText = formatPrice(item.price);
  ctx.font = font(13, 600);
  const priceWidth = ctx.measureText(priceText).width;
  const nameLines = wrapText(ctx, item.name, CONTENT_WIDTH - DISH_TEXT_INDENT - priceWidth - 16);
  ctx.font = font(11);
  const descLines = wrapText(ctx, item.description, CONTENT_WIDTH - DISH_TEXT_INDENT);
  const slots = availableSlotLabels(item);
  const availabilityText = slots.length ? slots.join('  ·  ') : 'Currently unavailable';
  const isVeg = isFlagSet(item.isVeg);

  return {
    height: 8 + nameLines.length * 18 + (descLines.length ? 2 + descLines.length * 15 : 0) + 4 + 13 + 8,
    draw(c, top) {
      let y = top + 8;
      const textX = MARGIN + DISH_TEXT_INDENT;

      // Veg / non-veg mark, matching the dashboard's square-with-dot icon
      const markColor = isVeg ? COLORS.veg : COLORS.nonVeg;
      c.strokeStyle = markColor;
      c.lineWidth = 1.2;
      c.strokeRect(MARGIN + 0.6, y + 3.6, 10, 10);
      c.fillStyle = markColor;
      c.beginPath();
      c.arc(MARGIN + 5.6, y + 8.6, 2.6, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = COLORS.text;
      c.font = font(13, 600);
      c.textAlign = 'right';
      c.fillText(priceText, PAGE_WIDTH - MARGIN, y);
      c.textAlign = 'left';
      nameLines.forEach(line => { c.fillText(line, textX, y); y += 18; });

      if (descLines.length) {
        y += 2;
        c.fillStyle = COLORS.muted;
        c.font = font(11);
        descLines.forEach(line => { c.fillText(line, textX, y); y += 15; });
      }

      y += 4;
      c.fillStyle = slots.length ? COLORS.available : COLORS.muted;
      c.font = font(10, 500);
      c.fillText(availabilityText, textX, y);
    }
  };
}

function layoutMenu(menu) {
  const { ctx } = createCanvas(1, 1, 1);
  const blocks = [headerBlock(ctx, menu)];
  exportableCategories(menu.categories).forEach(category => {
    blocks.push(categoryBlock(ctx, category));
    category.items.forEach(item => blocks.push(dishBlock(ctx, item)));
  });
  return blocks;
}

/** Splits blocks into pages, keeping each category heading with its first dish. */
function paginate(blocks, pageContentHeight) {
  const pages = [[]];
  let used = 0;
  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    const needed = block.keepWithNext && next ? block.height + next.height : block.height;
    if (used > 0 && used + needed > pageContentHeight) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(block);
    used += block.height;
  });
  return pages;
}

const drawBlocks = (ctx, blocks, top) => {
  let y = top;
  blocks.forEach(block => { block.draw(ctx, y); y += block.height; });
};

const canvasToBlob = (canvas, type) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), type);
});

async function waitForFonts() {
  try {
    await document.fonts?.ready;
  } catch {
    // Fall back to whatever fonts are available.
  }
}

async function exportImage(menu) {
  await waitForFonts();
  const blocks = layoutMenu(menu);
  const height = MARGIN * 2 + blocks.reduce((sum, block) => sum + block.height, 0);
  // Stay inside browser canvas limits (iOS Safari caps the area at ~16.7M pixels).
  const scale = Math.min(2, 32000 / height, Math.sqrt(16000000 / (PAGE_WIDTH * height)));
  const { canvas, ctx } = createCanvas(PAGE_WIDTH, height, scale);
  drawBlocks(ctx, blocks, MARGIN);
  downloadBlob(await canvasToBlob(canvas, 'image/png'), getMenuExportFileName(menu.restaurantName, 'png'));
}

async function exportPdf(menu) {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), waitForFonts()]);
  const pages = paginate(layoutMenu(menu), PAGE_HEIGHT - MARGIN * 2 - PDF_FOOTER_HEIGHT);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  pages.forEach((blocks, index) => {
    const { canvas, ctx } = createCanvas(PAGE_WIDTH, PAGE_HEIGHT, 3);
    drawBlocks(ctx, blocks, MARGIN);
    if (pages.length > 1) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = font(9);
      ctx.textAlign = 'center';
      ctx.fillText(`Page ${index + 1} of ${pages.length}`, PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN / 2 - 9);
    }
    if (index > 0) pdf.addPage();
    pdf.addImage(canvas, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
  });

  pdf.save(getMenuExportFileName(menu.restaurantName, 'pdf'));
}

const EXPORTERS = { excel: exportExcel, pdf: exportPdf, image: exportImage };

/**
 * Downloads the menu in the given format.
 * @param {'excel'|'pdf'|'image'} format
 * @param {{ categories: Array, restaurantName?: string, tagline?: string, address?: string }} menu
 */
export function downloadMenu(format, menu) {
  const exporter = EXPORTERS[format];
  if (!exporter) return Promise.reject(new Error(`Unknown menu export format: ${format}`));
  return exporter(menu);
}
