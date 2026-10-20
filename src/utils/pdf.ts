/**
 * 把完整的打印用 HTML 直接渲染成 PDF 文件并下载。
 * 不打开打印窗口，因此不会再出现浏览器打印对话框。
 */
export async function downloadHtmlAsPdf(html: string, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // 从完整 HTML 文档里取出样式和 body，放进一个离屏容器。
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const styles = Array.from(parsed.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("");
  const body = parsed.body.innerHTML;

  const container = document.createElement("div");
  // html2canvas 对隐藏元素容易截成空白，生成期间临时覆盖在页面上。
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "190mm";
  container.style.background = "#ffffff";
  container.style.zIndex = "9999";
  container.style.pointerEvents = "none";
  container.innerHTML = `${styles}${body}`;
  document.body.appendChild(container);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => window.setTimeout(resolve, 120)),
    );

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;

    // 批量发票里每个客户是 .doc；单张发票没有 .doc，就把整个容器当作一页。
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(".doc"));
    const sections = nodes.length > 0 ? nodes : [container];
    let hasPage = false;

    for (const section of sections) {
      if (section.scrollHeight <= 0) continue;
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      if (canvas.width <= 0 || canvas.height <= 0) continue;

      const pxPerMm = canvas.width / contentWidth;
      const pageSliceHeight = Math.max(1, Math.floor(contentHeight * pxPerMm));
      let offset = 0;

      while (offset < canvas.height) {
        const sliceHeight = Math.min(
          pageSliceHeight,
          canvas.height - offset,
        );
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const context = slice.getContext("2d");
        if (!context) throw new Error("canvas-unavailable");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, slice.width, slice.height);
        context.drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        if (hasPage) pdf.addPage();
        hasPage = true;
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          margin,
          margin,
          contentWidth,
          sliceHeight / pxPerMm,
          undefined,
          "FAST",
        );
        offset += sliceHeight;
      }
    }

    if (!hasPage) throw new Error("pdf-empty");
    pdf.save(filename);
  } finally {
    container.remove();
  }
}
