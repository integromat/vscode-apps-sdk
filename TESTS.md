Manual testing scenarios
========================

*Note: Each `test` starts in the clear state and shoul be independent to the previous testing.*

Clone the app
-------------

### Test: Clone the app with no folder opened

Expected result:

1. Error message "No folder opened." is displayed.

### Test: Clone the app with workspace opened

Use default cloning directory `src`.

Expected result:

1. User asked to select the folder
2. App is cloned into the folder.
3. Api key is stored into root workspace directory `/.secrets`.

### Test: Clone the app to custom directory

Use default cloning directory `src/anysubdir/anysubdir`.

Expected result:

1. User asked to select the folder
2. App is cloned into the folder.
3. Api key is stored into root workspace directory `/.secrets`.

Compare with Make
-----------------

### Test: Compare code file

Right-click to any local code file and run "Compare with Mae"

Expected result:

1. Diff window will be displayed
