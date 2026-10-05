# Princeton Intro to Robotics — совместный просмотр

Вводный курс Anirudha Majumdar (Princeton). Темы: motion planning, feedback control, state estimation и SLAM, machine learning для робототехники (imitation learning, diffusion models, RL, vision-language-action модели), практика на квадрокоптерах Crazyflie.

## Ссылки

- [Сайт курса](https://irom-lab.princeton.edu/intro-to-robotics/): видео, слайды, конспекты, задания
- [YouTube-канал курса](https://www.youtube.com/@intro-to-robotics/playlists)
- [Код заданий на GitHub](https://github.com/Princeton-Introduction-to-Robotics/F2026)

## Формат

- Каждый смотрит лекции сам в течение недели.
- В понедельник час обсуждения в Zoom.
- Старт: **2026-10-12**. К первой встрече нужно посмотреть две лекции: вводную и про планирование движения. Дальше по одной в неделю.

## Расписание

| Встреча | Дата | Лекции | Заметки |
|---|---|---|---|
| 1 | 2026-10-12 | 1. [Intro to Robotics](https://youtu.be/cMhFAq53v1c)<br>2. [Discrete planning (graph search)](https://youtu.be/LhLd8Kon1GY) | |
| 2 | 2026-10-19 | 3. [Randomized planning (RRTs)](https://youtu.be/KDIe1094FMo) | |
| 3 | 2026-10-26 | 4. [Quadrotor dynamics](https://youtu.be/upI4KaGawyE) | |
| 4 | 2026-11-02 | 5. [Differential flatness](https://youtu.be/64Rfzm359Xg) | |
| 5 | 2026-11-09 | 6. Trajectory optimization | |
| 6 | 2026-11-16 | 7. Stability, PD control | |
| 7 | 2026-11-23 | 8. Linear Quadratic Regulator (LQR) | |
| 8 | 2026-11-30 | 9. Camera models, optical flow | |
| 9 | 2026-12-07 | 10. Nondeterministic filter | |
| 10 | 2026-12-14 | 11. Bayes filtering | |
| 11 | 2026-12-21 | 12. Kalman filtering and particle filtering | |
| 12 | 2026-12-28 | 13. Localization | |
| 13 | 2027-01-04 | 14. Mapping | |
| 14 | 2027-01-11 | 15. Simultaneous localization and mapping (SLAM) | |
| 15 | 2027-01-18 | 16. Imitation learning | |
| 16 | 2027-01-25 | 17. Generative architectures (flow matching, diffusion) | |
| 17 | 2027-02-01 | 19. Data augmentation and DAgger | |
| 18 | 2027-02-08 | 20. Vision-language-action models (VLAs) | |
| 19 | 2027-02-15 | 21. Reinforcement learning - I | |
| 20 | 2027-02-22 | 22. Reinforcement learning - II | |
| 21 | 2027-03-01 | 23. World models | |
| 22 | 2027-03-08 | 24. Robotics and jobs, ethics, and laws | |

Лекция 18 по программе курса — экзамен, её пропускаем. Даты посчитаны «по лекции в неделю» без пропусков на праздники. Ссылки на видео есть для тех лекций, которые уже опубликованы.

## Структура папки

- `lectures/` — заметки по лекциям (`NN-<slug>.md`)
- `meetings/` — что обсуждали на встречах (`YYYY-MM-DD.md`)
- `project/` — ноутбуки-тренажёры к лекциям, см. [project/README.md](project/README.md)
- `site/` — интерактивный стенд «схема робота + 2D-мир дрона», опубликован на [princeton-intro-robotics.vercel.app](https://princeton-intro-robotics.vercel.app), каждый пуш в `main` деплоится автоматически (`vercel.json` отдаёт папку `site/` как статику)

Локально стенд открывается без сборки: `open site/index.html`.
