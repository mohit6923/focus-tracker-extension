# Focus Tracker Extension

A Chrome browser extension that helps you track your browsing activity during focus sessions. Monitor which websites you visit and how much time you spend on each one, and set goals for your focused work.

## Features

- **Two Focus Modes**: Choose between a "Quick Start" session or a "Goal-Based" session.
- **Goal Management**: Set specific goals for your focus sessions, including optional target completion times.
- **Focus Session Tracking**: Start and stop focus sessions to track your browsing activity.
- **Real-time Monitoring**: Automatically tracks time spent on different websites.
- **Analytics Dashboard**:
    - **Session History**: Review past focus sessions with detailed website breakdowns.
    - **Goal Analytics**: Track your performance against your set goals, with completion rates and time analysis.
- **Data Persistence**: All session and goal data is stored locally and persists between browser sessions.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" by toggling the switch in the top-right corner.
4. Click "Load unpacked" and select the `focus-tracker-extension` folder.
5. The extension should now appear in your extensions list.

## Usage

### Starting a Focus Session

1. Click the Focus Tracker extension icon in your Chrome toolbar.
2. You have two options:
    * **Quick Start**: Click "QUICK START" for a general focus session without predefined goals.
    * **Goal-Based**: Click "GOAL BASED" to set specific goals for your session.
        1. The view will switch to the goal management screen.
        2. Enter a goal in the input field and an optional target time in minutes.
        3. Click "Add Goal" to add it to the list for the upcoming session.
        4. Select one or more goals from the list.
        5. Click "Start" to begin the focus session with the selected goals.
3. Browse normally - the extension will automatically track your activity.

### Viewing Analytics

1. After completing a focus session, click "Stop Focus".
2. Click "View Analytics" to open the analytics dashboard in a new tab.
3. The dashboard has three main sections:
    * **Session History**: A detailed log of all your past focus sessions. Click on any session to see a doughnut chart of the websites you visited and the time spent on each.
    * **Websites**: An aggregated view of the top websites you visit across all focus sessions, with progress bars indicating their frequency.
    * **Goal Analytics**: An overview of your goal-related performance, including completion rates, average target times, and a chart visualizing your progress over time.

### How It Works

- The extension tracks tab switches and URL changes.
- Time is recorded in milliseconds and converted to seconds for display.
- Session data, including associated goals, is stored locally in Chrome's storage.
- Only HTTP/HTTPS websites are tracked (chrome:// URLs are ignored).

## Files Structure

```
focus-tracker-extension/
├── README.md
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
├── background.js
├── analytics.html
├── analytics.js
├── chart.min.js
├── images/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── debug.html
├── test-analytics.html
└── test-chart.html
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Permissions**: `storage` (for data persistence), `tabs` (for activity tracking)
- **Chart Library**: Chart.js (included locally)
- **Data Format**: Time spent per domain in milliseconds.

## Development

To modify the extension:

1. Make your changes to the relevant files.
2. Go to `chrome://extensions/`.
3. Click the refresh button on the Focus Tracker extension.
4. Test your changes.

## Troubleshooting

- **Extension won't load**: Check that all files are present and `manifest.json` is valid.
- **Analytics not showing**: Make sure you've completed a focus session with some browsing activity.
- **Chart not displaying**: Check the browser console for JavaScript errors.

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues and enhancement requests! 