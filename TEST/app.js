let DataUser = {
    "id": 3,
    "autres": 3
}
localStorage.setItem('UserData', JSON.stringify(DataUser));


var userData = JSON.parse(localStorage.getItem('UserData'));



const imageInputs = document.querySelectorAll('.parametres-image-selector input[type="radio"]');
imageInputs.forEach(input => {
    input.addEventListener('change', function() {
        const selectedImage = this.value;
        console.log('Image sélectionnée:', selectedImage);
        // Ici, vous pouvez effectuer des actions en fonction de l'image sélectionnée
        axios.post('/data/user/params/write', {
            "id": userData.id,
            "background": selectedImage
        })
        .then(function (response) {
            console.log(response);
            $('.parametres-previewImg').attr('src', selectedImage);
        })
    });
});

console.log('START');