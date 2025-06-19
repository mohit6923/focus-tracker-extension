# Focus Tracker Extension

A Chrome browser extension that helps you track your browsing activity during focus sessions. Monitor which websites you visit and how much time you spend on each one.

## Features

- **Focus Session Tracking**: Start and stop focus sessions to track your browsing activity
- **Real-time Monitoring**: Automatically tracks time spent on different websites
- **Analytics Dashboard**: View a pie chart showing your browsing patterns
- **Data Persistence**: Session data is stored locally and persists between browser sessions

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the `focus-tracker-extension` folder
5. The extension should now appear in your extensions list

## Usage

### Starting a Focus Session
1. Click the Focus Tracker extension icon in your Chrome toolbar
2. Click "Start Focus" to begin tracking
3. Browse normally - the extension will automatically track your activity

### Viewing Analytics
1. After completing a focus session, click "Stop Focus"
2. Click "View Analytics" to see a pie chart of your browsing activity
3. The chart shows time spent on each website with percentages

### How It Works
- The extension tracks tab switches and URL changes
- Time is recorded in milliseconds and converted to seconds for display
- Data is stored locally in Chrome's storage
- Only HTTP/HTTPS websites are tracked (chrome:// URLs are ignored)

## Files Structure

```
focus-tracker-extension/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── popup.css              # Popup styling
├── background.js          # Background service worker
├── analytics.html         # Analytics page
├── analytics.js           # Analytics functionality
├── chart.min.js           # Chart.js library (local copy)
├── images/                # Extension icons (if added)
├── test-chart.html        # Test file for Chart.js
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Permissions**: `storage` (for data persistence), `tabs` (for activity tracking)
- **Chart Library**: Chart.js v4.4.0 (included locally)
- **Data Format**: Time spent per domain in milliseconds

## Development

To modify the extension:
1. Make your changes to the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh button on the Focus Tracker extension
4. Test your changes

## Troubleshooting

- **Extension won't load**: Check that all files are present and manifest.json is valid
- **Analytics not showing**: Make sure you've completed a focus session with some browsing activity
- **Chart not displaying**: Check browser console for JavaScript errors

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues and enhancement requests! 