# Example how to upload files to S3
First, you should to set the variables in file `index.js`.

In `html` code or component or wherever
```html
<input onchange="functionSaveFile">
```
In your `js` code
```
import uploadFileToS3 from './index'

functionSaveFile($event) {
  let file = $event.target.files[0]
  uploadFileToS3(file)
    .then((response) => {
      console.log(response)
    })
}

```