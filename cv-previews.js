/* =========================================================
   ПРЕВЬЮ ПРОЕКТОВ ПРИ ПРОКРУТКЕ (главная страница)
========================================================= */

/*
 * Работает на больших экранах (ширина от 1301px, высота от 700px).
 *
 * 1) Первая часть прокрутки: подробности блоков «Образование»,
 *    «Программы» и «Участие» исчезают, их заголовки перемещаются
 *    столбиком под контакты, а в центре появляются превью проектов.
 * 2) Дальнейшая прокрутка листает превью по вертикали.
 *
 * Линии соединяют каждое превью с названием проекта справа.
 * Клик по заголовку в столбике возвращает исходный вид.
 * На узких экранах и телефонах страница работает как раньше.
 *
 * Стили лежат в файле cv-previews.css.
 */

(function () {

    /* ---------- НАСТРОЙКИ ---------- */

    // Картинки превью, по порядку проектов в списке справа.
    // src — основная (для английской версии), srcRu — для русской.
    const PREVIEW_IMAGES = [
        { src: "tree_revolution/photo_2024-08-09_23-47-07.jpg" },
        { src: "theatre/theatre_wide.jpg", srcRu: "theatre/ru/theatre_wide.jpg" },
        { src: "ski_resort/ski_1.jpg", srcRu: "ski_resort/ru/ski_1.jpg" },
        { src: "rhino/rhino_2.jpg" },
        { src: "slicer/en/slide_6_page-0001.jpg", srcRu: "slicer/ru/slide_6_page-0001.jpg" }
    ];

    // Сколько пикселей прокрутки уходит на смену блоков превью
    const PHASE_DISTANCE = 560;

    // Ширина превью как доля ширины окна (высота считается как 16:9)
    const PREVIEW_WIDTH_RATIO = 0.333;

    // Зазор между превью как доля их высоты
    const GAP_RATIO = 0.085;

    // Эффект включается только на больших экранах
    const MIN_SCREEN_WIDTH = 1301;
    const MIN_SCREEN_HEIGHT = 700;
    const MIN_PREVIEW_WIDTH = 260;


    /* ---------- ЭЛЕМЕНТЫ ---------- */

    const root = document.documentElement;

    const row = document.querySelector(".blocks-row");
    const imageBlock = document.querySelector(".image-block");
    const nameBlock = document.querySelector(".name-block");

    if (!row || !imageBlock || !nameBlock) {
        return;
    }

    const blocks = Array.from(row.children).filter(
        el => el.classList.contains("block-item")
    );

    if (blocks.length < 4) {
        return;
    }

    const headings = blocks.slice(0, 3).map(
        block => block.querySelector(".text-line.heading")
    );

    const links = Array.from(
        blocks[3].querySelectorAll(".project-link")
    );

    if (headings.some(h => !h) || !links.length) {
        return;
    }

    // Блок контактов (лежит внутри блока «Программы»)
    const contactBlock = document.querySelector(".contact-block");

    const contactHost =
        contactBlock ? contactBlock.closest(".block-item") : null;


    /* ---------- СОЗДАЁМ ПРЕВЬЮ И ЛИНИИ ---------- */

    const previews = document.createElement("div");
    previews.className = "previews";

    const track = document.createElement("div");
    track.className = "previews-track";

    previews.appendChild(track);

    const items = links.map(link => {

        const a = document.createElement("a");
        a.className = "preview-item";
        a.href = link.getAttribute("href");

        const img = new Image();
        img.decoding = "async";
        img.draggable = false;
        img.alt = "";

        a.appendChild(img);
        track.appendChild(a);

        // Наведение на превью подсвечивает название и наоборот
        a.addEventListener("mouseenter", () => {
            link.classList.add("hover-sync");
        });

        a.addEventListener("mouseleave", () => {
            link.classList.remove("hover-sync");
        });

        link.addEventListener("mouseenter", () => {
            a.classList.add("is-active");
        });

        link.addEventListener("mouseleave", () => {
            a.classList.remove("is-active");
        });

        return { a: a, img: img, link: link };
    });

    const SVG_NS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "preview-lines");

    const lines = items.map(() => {
        const line = document.createElementNS(SVG_NS, "polyline");
        svg.appendChild(line);
        return line;
    });

    document.body.appendChild(previews);
    document.body.appendChild(svg);

    // Стрелка «прокрутите вниз»: видна только в исходном состоянии
    const arrow = document.createElement("button");
    arrow.className = "cv-arrow hidden";
    arrow.type = "button";
    arrow.innerHTML =
        '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<polyline points="5,10 14,19 23,10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

    document.body.appendChild(arrow);


    /* ---------- ВСПОМОГАТЕЛЬНОЕ ---------- */

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function ease(t) {
        return t < 0.5
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function easeCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Положение элемента на странице без учёта transform-анимаций
    function pagePos(el) {

        let x = 0;
        let y = 0;

        while (el && el !== document.body) {
            x += el.offsetLeft;
            y += el.offsetTop;
            el = el.offsetParent;
        }

        return { x: x, y: y };
    }


    /* ---------- СОСТОЯНИЕ ---------- */

    let enabled = false;

    let pos = 0;        // текущая «прокрутка», px
    let target = 0;     // куда она плавно едет
    let maxPos = 0;

    let geo = null;     // измеренная геометрия

    let rafId = null;
    let lastTime = 0;

    let lastDir = 1;
    let snapTimer = null;

    // Стрелка появляется не сразу, а когда закончится появление страницы
    let introDone = false;


    function setEnabled(on) {

        if (enabled === on) {
            return;
        }

        enabled = on;

        root.classList.toggle("cv-scroll", on);

        if (!on) {

            pos = 0;
            target = 0;

            root.style.removeProperty("--cv-p");
            root.style.removeProperty("--stack-w");

            root.classList.remove("cv-details-off", "cv-stacked");

            headings.forEach(h => {
                h.style.translate = "";
            });

            if (contactBlock) {
                contactBlock.style.translate = "";
            }

            nameBlock.style.translate = "";
            nameBlock.style.scale = "";

            arrow.classList.add("hidden");

            previews.classList.remove("visible", "interactive");
            previews.style.opacity = "0";

            lines.forEach(line => {
                line.style.opacity = "0";
            });
        }
    }


    /* ---------- ИЗМЕРЕНИЕ ---------- */

    function measure() {

        // Фото ещё не загрузилось — измерим позже
        if (!imageBlock.offsetWidth) {
            return;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const photoRight =
            imageBlock.offsetLeft + imageBlock.offsetWidth;

        const photoTop = imageBlock.offsetTop;

        const photoBottom =
            photoTop + imageBlock.offsetHeight;

        let minLinkLeft = Infinity;

        links.forEach(link => {
            minLinkLeft = Math.min(minLinkLeft, pagePos(link).x);
        });

        // Блок проектов: при прокрутке имя уменьшается до его ширины
        // и встаёт по его правому краю (по краю текста, без отступов)
        const projectsBox = blocks[3];

        const projectsBoxStyle =
            getComputedStyle(
                projectsBox.querySelector(".text-content") || projectsBox
            );

        const projectsPadLeft =
            parseFloat(projectsBoxStyle.paddingLeft) || 0;

        const projectsPadRight =
            parseFloat(projectsBoxStyle.paddingRight) || 0;

        const projectsRight =
            pagePos(projectsBox).x +
            projectsBox.offsetWidth -
            projectsPadRight;

        const projectsWidth =
            projectsBox.offsetWidth -
            projectsPadLeft -
            projectsPadRight;

        const nameWidth = nameBlock.offsetWidth;

        const nameScale =
            nameWidth > projectsWidth
                ? projectsWidth / nameWidth
                : 1;

        // Свободное место между левым столбиком и правой частью
        const leftLimit = photoRight + 48;

        // Имя к моменту появления превью уже уменьшилось, поэтому
        // ограничивает превью не первоначальная ширина имени, а уменьшенная
        const nameLeftAfterShrink =
            projectsRight - nameWidth * nameScale;

        const rightLimit = Math.min(
            minLinkLeft - 24 - 120,
            nameLeftAfterShrink - 32
        );

        const availableWidth = rightLimit - leftLimit;

        const canEnable =
            vw >= MIN_SCREEN_WIDTH &&
            vh >= MIN_SCREEN_HEIGHT &&
            availableWidth >= MIN_PREVIEW_WIDTH;

        if (!canEnable) {
            setEnabled(false);
            return;
        }

        setEnabled(true);


        /* --- превью --- */

        const width = Math.min(
            vw * PREVIEW_WIDTH_RATIO,
            availableWidth
        );

        let left = vw / 2 - width / 2;

        left = clamp(
            left,
            leftLimit,
            Math.max(leftLimit, rightLimit - width)
        );

        const height = width * 9 / 16;
        const gap = Math.round(height * GAP_RATIO);

        track.style.left = left + "px";
        track.style.top = photoTop + "px";
        track.style.width = width + "px";
        track.style.setProperty("--preview-gap", gap + "px");

        const listHeight =
            items.length * height + (items.length - 1) * gap;

        const maxList = Math.max(
            0,
            photoTop + listHeight + photoTop - vh
        );

        maxPos = PHASE_DISTANCE + maxList;


        /* --- заголовки: куда они должны переехать --- */

        const headingStyle = getComputedStyle(headings[0]);

        const spacing =
            headings[0].offsetHeight +
            (parseFloat(headingStyle.marginBottom) || 0);

        const stackHeight =
            2 * spacing + headings[0].offsetHeight;

        const contactHeight =
            contactBlock ? contactBlock.offsetHeight : 0;

        // Свободное место по высоте делим на два зазора:
        // между фото и контактами и между контактами и заголовками
        const gapsTotal = clamp(
            vh - 24 - photoBottom - contactHeight - stackHeight,
            40,
            90
        );

        const contactTop =
            photoBottom + gapsTotal * 0.42;

        const stackTop =
            contactTop + contactHeight + gapsTotal * 0.58;

        let widest = 0;

        const moves = headings.map((heading, i) => {

            const p = pagePos(heading);

            widest = Math.max(widest, heading.offsetWidth);

            return {
                dx: photoRight - (p.x + heading.offsetWidth),
                dy: stackTop + i * spacing - p.y
            };
        });

        root.style.setProperty("--stack-w", widest + "px");


        /* --- линии: куда они приходят --- */

        const linkY = links.map(
            link => pagePos(link).y + link.offsetHeight / 2
        );

        /* --- контакты: куда они должны переехать --- */

        let contactMove = null;

        if (contactBlock && contactHost) {

            const hostPos = pagePos(contactHost);

            const contactStyle = getComputedStyle(contactBlock);

            // Сейчас контакты прижаты к правому краю блока «Программы»
            const baseRight =
                hostPos.x + contactHost.offsetWidth -
                (parseFloat(contactStyle.right) || 0);

            const baseTop =
                hostPos.y + (parseFloat(contactStyle.top) || 0);

            contactMove = {
                dx: photoRight - baseRight,
                dy: contactTop - baseTop
            };
        }

        geo = {
            moves: moves,
            contactMove: contactMove,
            name: {
                scale: nameScale,
                dx: projectsRight - (nameBlock.offsetLeft + nameWidth)
            },
            linkY: linkY,
            endX: minLinkLeft - 24,
            travel: vh - photoTop + 12
        };

        pos = clamp(pos, 0, maxPos);
        target = clamp(target, 0, maxPos);

        render();
    }


    /* ---------- ОТРИСОВКА ---------- */

    function render() {

        if (!enabled || !geo) {
            return;
        }

        const p = clamp(pos / PHASE_DISTANCE, 0, 1);
        const listY = Math.max(0, pos - PHASE_DISTANCE);

        root.style.setProperty("--cv-p", p.toFixed(4));

        const eased = ease(p);

        headings.forEach((heading, i) => {

            const move = geo.moves[i];

            heading.style.translate =
                (move.dx * eased) + "px " +
                (move.dy * eased) + "px";
        });

        if (contactBlock && geo.contactMove) {

            contactBlock.style.translate =
                (geo.contactMove.dx * eased) + "px " +
                (geo.contactMove.dy * eased) + "px";
        }

        // Имя прижимается к правому краю и уменьшается до ширины блока проектов.
        // Используются свойства translate и scale (а не transform): на transform
        // у блока имени уже стоит анимация появления страницы.
        nameBlock.style.translate =
            (geo.name.dx * eased) + "px 0px";

        nameBlock.style.scale =
            String(1 + (geo.name.scale - 1) * eased);

        // Стрелка видна только в исходном состоянии
        arrow.classList.toggle("hidden", !(p < 0.02 && introDone));

        // Превью выезжают снизу экрана до своего места
        const entry = clamp((p - 0.06) / 0.94, 0, 1);

        const entryOffset =
            (1 - easeCubic(entry)) * geo.travel;

        previews.style.opacity = String(clamp(p / 0.12, 0, 1));

        track.style.transform =
            "translateY(" + (entryOffset - listY) + "px)";

        previews.classList.toggle("visible", p > 0.005);
        previews.classList.toggle("interactive", p >= 0.98);

        // Линии появляются в конце, когда превью уже доехали
        const appear = clamp((p - 0.7) / 0.3, 0, 1);

        root.classList.toggle("cv-details-off", p > 0.15);
        root.classList.toggle("cv-stacked", p >= 0.98);

        updateLines(appear);
    }


    function updateLines(appear) {

        const vh = window.innerHeight;

        items.forEach((item, i) => {

            const line = lines[i];

            const rect = item.a.getBoundingClientRect();

            const visibleTop = Math.max(rect.top, 0);
            const visibleBottom = Math.min(rect.bottom, vh);
            const visibleHeight = visibleBottom - visibleTop;

            if (visibleHeight < 24 || appear <= 0) {
                line.style.opacity = "0";
                return;
            }

            const x0 = rect.right + 13;
            const y0 = (visibleTop + visibleBottom) / 2;

            const y1 = geo.linkY[i];

            const endX = geo.endX;

            const elbowX = x0 + (endX - x0) * 0.55;

            line.setAttribute(
                "points",
                x0 + "," + y0 + " " +
                elbowX + "," + y1 + " " +
                endX + "," + y1
            );

            line.style.opacity = String(
                appear *
                clamp((visibleHeight - 24) / 40, 0, 1)
            );
        });
    }


    /* ---------- ПЛАВНАЯ ПРОКРУТКА ---------- */

    function tick(now) {

        rafId = null;

        const dt = Math.min(64, now - lastTime);

        lastTime = now;

        pos += (target - pos) * (1 - Math.exp(-dt / 110));

        if (Math.abs(target - pos) < 0.15) {
            pos = target;
        }

        render();

        if (pos !== target) {
            rafId = requestAnimationFrame(tick);
        }
    }


    function start() {

        if (rafId === null) {

            lastTime = performance.now();

            rafId = requestAnimationFrame(tick);
        }
    }


    function scheduleSnap() {

        clearTimeout(snapTimer);

        snapTimer = setTimeout(() => {

            // Остановились посередине перехода — доводим до края
            if (target > 0 && target < PHASE_DISTANCE) {

                const threshold = lastDir > 0 ? 0.12 : 0.88;

                target =
                    target / PHASE_DISTANCE > threshold
                        ? PHASE_DISTANCE
                        : 0;

                start();
            }

        }, 140);
    }


    function setTarget(value) {

        target = clamp(value, 0, maxPos);

        start();
        scheduleSnap();
    }


    /* ---------- УПРАВЛЕНИЕ ---------- */

    window.addEventListener("wheel", event => {

        if (!enabled || event.ctrlKey) {
            return;
        }

        event.preventDefault();

        let delta = event.deltaY;

        if (event.deltaMode === 1) {
            delta *= 32;
        } else if (event.deltaMode === 2) {
            delta *= window.innerHeight;
        }

        if (delta !== 0) {
            lastDir = delta > 0 ? 1 : -1;
        }

        setTarget(target + delta);

    }, { passive: false });


    let touchY = null;

    window.addEventListener("touchstart", event => {

        if (!enabled) {
            return;
        }

        touchY = event.touches[0].clientY;

    }, { passive: true });

    window.addEventListener("touchmove", event => {

        if (!enabled || touchY === null) {
            return;
        }

        event.preventDefault();

        const y = event.touches[0].clientY;

        const delta = touchY - y;

        touchY = y;

        if (delta !== 0) {
            lastDir = delta > 0 ? 1 : -1;
        }

        setTarget(target + delta * 1.4);

    }, { passive: false });

    window.addEventListener("touchend", () => {
        touchY = null;
    });


    window.addEventListener("keydown", event => {

        if (!enabled) {
            return;
        }

        if (/^(input|textarea|select)$/i.test(event.target.tagName)) {
            return;
        }

        const page = window.innerHeight * 0.8;

        let next = null;

        switch (event.key) {

            case "ArrowDown":
                next = target + 90;
                break;

            case "ArrowUp":
                next = target - 90;
                break;

            case "PageDown":
                next = target + page;
                break;

            case "PageUp":
                next = target - page;
                break;

            case " ":
                next = target + (event.shiftKey ? -page : page);
                break;

            case "Home":
                next = 0;
                break;

            case "End":
                next = maxPos;
                break;

            default:
                return;
        }

        event.preventDefault();

        lastDir = next > target ? 1 : -1;

        setTarget(next);
    });


    // Клик по стрелке внизу переводит страницу в состояние с превью
    arrow.addEventListener("click", () => {

        if (!enabled) {
            return;
        }

        lastDir = 1;

        setTarget(PHASE_DISTANCE);
    });


    // Клик по заголовку в столбике возвращает исходный вид
    headings.forEach(heading => {

        heading.addEventListener("click", () => {

            if (!enabled || pos < PHASE_DISTANCE * 0.5) {
                return;
            }

            lastDir = -1;

            setTarget(0);
        });
    });


    /* ---------- ЯЗЫК ---------- */

    function refreshImages(lang) {

        items.forEach((item, i) => {

            const config = PREVIEW_IMAGES[i] || {};

            const src =
                lang === "ru" && config.srcRu
                    ? config.srcRu
                    : config.src;

            if (src && item.img.getAttribute("src") !== src) {
                item.img.src = src;
            }

            const title = item.link.textContent.trim();

            item.img.alt = title;
            item.a.setAttribute("aria-label", title);
        });

        arrow.setAttribute(
            "aria-label",
            lang === "ru" ? "Прокрутить вниз" : "Scroll down"
        );
    }


    /* ---------- ПЕРЕИЗМЕРЕНИЕ ---------- */

    // Двойной requestAnimationFrame: сначала успевают выровняться
    // колонки (скрипты на странице), и только потом измеряем.

    let measureQueued = false;

    function scheduleMeasure() {

        if (measureQueued) {
            return;
        }

        measureQueued = true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                measureQueued = false;
                measure();
            });
        });
    }

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("load", scheduleMeasure);

    const photo = imageBlock.querySelector("img");

    if (photo) {
        photo.addEventListener("load", scheduleMeasure);
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleMeasure);
    }

    if (window.ResizeObserver) {

        const observer = new ResizeObserver(scheduleMeasure);

        observer.observe(imageBlock);
        observer.observe(nameBlock);
        observer.observe(blocks[3]);
    }

    document.addEventListener("cv-language", event => {

        refreshImages(event.detail);

        scheduleMeasure();
    });

    refreshImages(
        document.documentElement.lang === "ru" ? "ru" : "en"
    );

    scheduleMeasure();

    setTimeout(() => {

        introDone = true;

        render();

    }, 1300);

})();
