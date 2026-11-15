/* =========================================================
   ОБЩАЯ ЛОГИКА СТРАНИЦ ПРОЕКТОВ
   Подключается на всех страницах проектов (стили — в файле
   project-common.css).

   1) Подгоняет размер слайдов карусели под пропорции картинок:
      высота у всех страниц одинаковая, ширина — по самой
      широкой картинке (но не больше 90% области карусели).
   2) Добавляет кнопку закрытия и закрытие по клику в центр
      картинки при просмотре на всё окно.
========================================================= */

(function () {

    // Слайд не уже этой ширины (как было раньше), px
    const MIN_SLIDE_WIDTH = 800;

    // Слайд не шире этой доли области карусели
    const MAX_SLIDE_SHARE = 0.9;

    // Ширина окна, до которой слайд занимает 90vw (задаёт CSS)
    const NARROW_SCREEN = 900;


    const root = document.documentElement;

    let notifying = false;


    // Карусель слушает resize и пересчитывает свои размеры
    function notify() {

        notifying = true;

        window.dispatchEvent(new Event("resize"));

        notifying = false;
    }


    /*
     * silent = true — не сообщать карусели (используется, когда
     * карусель ещё не запущена и сама возьмёт размеры при старте).
     */
    function fitSlides(silent) {

        const container =
            document.querySelector(".carousel-container");

        if (!container) {
            return;
        }

        // На узких экранах ширину слайда задаёт CSS
        if (window.innerWidth <= NARROW_SCREEN) {

            if (root.style.getPropertyValue("--slide-width")) {

                root.style.removeProperty("--slide-width");

                if (!silent) {
                    notify();
                }
            }

            return;
        }

        let maxAspect = 0;

        document
            .querySelectorAll(".carousel-track .carousel-slide img")
            .forEach(img => {

                if (img.naturalWidth && img.naturalHeight) {

                    maxAspect = Math.max(
                        maxAspect,
                        img.naturalWidth / img.naturalHeight
                    );
                }
            });

        // Картинки ещё не загрузились — подгоним, когда загрузятся
        if (!maxAspect) {
            return;
        }

        const height =
            parseFloat(
                getComputedStyle(root).getPropertyValue("--carousel-height")
            ) || 600;

        const limit =
            Math.round(container.clientWidth * MAX_SLIDE_SHARE);

        const width = Math.min(
            limit,
            Math.max(MIN_SLIDE_WIDTH, Math.round(height * maxAspect))
        );

        const value = width + "px";

        if (root.style.getPropertyValue("--slide-width") === value) {
            return;
        }

        root.style.setProperty("--slide-width", value);

        if (!silent) {
            notify();
        }
    }

    window.fitSlides = fitSlides;


    document
        .querySelectorAll(".carousel-track .carousel-slide img")
        .forEach(img => {

            if (!img.complete) {

                img.addEventListener("load", () => {
                    fitSlides(false);
                });
            }
        });

    window.addEventListener("resize", () => {

        if (!notifying) {
            fitSlides(false);
        }
    });

    window.addEventListener("load", () => {
        fitSlides(false);
    });

    fitSlides(false);


    /* ---------- ПРОСМОТР НА ВСЁ ОКНО ---------- */

    const overlay = document.querySelector(".image-overlay");

    if (!overlay) {
        return;
    }

    // Закрытие делаем через Escape: эту клавишу уже обрабатывает
    // скрипт карусели на странице
    function closeOverlay() {

        document.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true
            })
        );
    }

    const closeButton = document.createElement("button");

    closeButton.type = "button";
    closeButton.className = "overlay-close";
    closeButton.setAttribute("aria-label", "Close");
    closeButton.textContent = "\u00d7";

    closeButton.addEventListener("click", event => {

        event.stopPropagation();

        closeOverlay();
    });

    overlay.appendChild(closeButton);

    const overlayImage = overlay.querySelector("img");

    // Клик в центральную часть картинки закрывает просмотр,
    // клики по краям листают (это делает скрипт страницы)
    if (overlayImage) {

        overlayImage.addEventListener("click", event => {

            const rect = overlayImage.getBoundingClientRect();

            const x = (event.clientX - rect.left) / rect.width;

            if (x > 0.3 && x < 0.7) {
                closeOverlay();
            }
        });
    }

})();
