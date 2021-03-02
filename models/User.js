const bcrypt = require('bcryptjs')
const usersCollection = require('../db').db().collection('users')
const validator = require('validator')
const md5 = require('md5')

let User = function(data, getGravatar) {  
    this.data = data
    this.errors = []
    if(getGravatar == undefined){
        getGravatar = false
    }
    if(getGravatar){
        this.getGravatar()
    }
}

User.prototype.cleanUp = function() {
    if (typeof(this.data.username) != 'string') {
        this.data.username = ''
    }
    if (typeof(this.data.email) != 'string') {
        this.data.email = ''
    }
    if (typeof(this.data.password) != 'string') {
        this.data.password = ''
    }

    // Get rid of any additional properties sent by user
    this.data = {
        username: this.data.username.trim().toLowerCase(),
        email: this.data.email.trim().toLowerCase(),
        password: this.data.password
    }
}

User.prototype.validate = function(){
    return new Promise(async (resolve, reject) => {
        let usernameLooksOK = true
        let emailLooksOK = true
        if(this.data.username == '') {
            this.errors.push('You must provide a username')
            usernameLooksOK = false
        }
        if(this.data.username != '' && !validator.isAlphanumeric(this.data.username)){
            this.errors.push('Username can only contain letters and numbers')
            usernameLooksOK = false
        }
        if(!validator.isEmail(this.data.email)) {
            this.errors.push('You must provide a valid email address')
            emailLooksOK = false
        }
        if(this.data.password == '') {
            this.errors.push('You must provide a password')
        }
        if(this.data.password.length > 0 && this.data.password.length < 12) {
            this.errors.push('The password must be alteast 12 characters')
        }
        if(this.data.password.length > 50){
            this.errors.push('The password cannot exceed 50 characters')
        }
        if(this.data.username.length > 0 && this.data.username.length < 3) {
            this.errors.push('The username must be alteast 3 characters')
            usernameLooksOK = false
        }
        if(this.data.username.length > 30){
            this.errors.push('The username cannot exceed 30 characters')
            usernameLooksOK = false
        }
    
        //Only is the username is valid, check to see if it's already taken
        if(usernameLooksOK){
            let usernameExists = await usersCollection.findOne({username: this.data.username})
            if(usernameExists){
                this.errors.push('That username is already taken')
            }
        }
    
        //Only is the email is valid, check to see if it's already taken
        if(emailLooksOK){
            let emailExists = await usersCollection.findOne({email: this.data.email})
            if(emailExists){
                this.errors.push('That email is already being used')
            }
        }
        resolve()
    })
}

User.prototype.register = function(){
    return new Promise(async (resolve, reject) => {
        // 1. Validate user data
        this.cleanUp()
        await this.validate()
    
        // 2. Only if there are no validation errors,
        //    then save the data into a db
        if(!this.errors.length){
            // Hash user password
            let salt = bcrypt.genSaltSync(10)
            this.data.password = bcrypt.hashSync(this.data.password, salt)
            
            /*
            IMPORTANT NOTE: The insertOne method modifies the object you pass it if it doesn't already contain an _id property and it will give it one. Since we're passing it this.data it will modify that object to give it an _id property.
            */
            await usersCollection.insertOne(this.data)
            this.getGravatar()
            resolve()
        } else {
            reject(this.errors)
        }   
    })
}

User.prototype.login = function() {
    return new Promise((resolve, reject) => {   
        this.cleanUp()
        // IMPORTANT: All mongodb database methods return a Promise
        usersCollection.findOne({username:this.data.username}).then((attemptedUser) => {
            if(attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {   
                // If login is successful, assign the logged-in user details
                // to this.data
                this.data = attemptedUser
                this.getGravatar()
                resolve('Congrats')
            } else {
                reject('Incorrect username/password')
            }
        }).catch(function(){
            reject('Please try again later')
        })
    })
}

User.prototype.getGravatar = function() {
    this.gravatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

User.findByUsername = function(username) {
    return new Promise(function(resolve, reject){
        if (typeof(username) != 'string') {
            reject()
            return
        }
        usersCollection.findOne({username: username}).then(function(userDoc){
            if (userDoc) {
                userDoc = new User(userDoc, true)  // to add gravatar
                userDoc = {
                    _id: userDoc.data._id,
                    username: userDoc.data.username,
                    gravatar: userDoc.gravatar
                }
                resolve(userDoc)
            } else {
                reject()
            }
        }).catch(function(){
            reject('')
        })
    })
}

User.doesEmailExist = function(email) {
    return new Promise(async function(resolve, reject){
        if(typeof(email) != 'string'){
            resolve(false)
            return
        }
        let user = await usersCollection.findOne({email: email})
        if(user) {
            resolve(true)
        } else {
            resolve(false)
        }
    })
}

module.exports = User