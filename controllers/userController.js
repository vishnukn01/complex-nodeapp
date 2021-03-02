const User = require('../models/User')
const Post = require('../models/Post')
const Follow = require('../models/Follow')
const jwt = require('jsonwebtoken')

exports.apiGetPostsByUsername = async function(req, res) {
    try {
        let authorDoc = await User.findByUsername(req.params.username)
        let posts = await Post.findByAuthorId(authorDoc._id)
        res.json(posts)
    } catch {
        res.json('Inavlid user requested.')
    }
}

exports.doesUsernameExist = function(req, res) {
    User.findByUsername(req.body.username).then(function(){
        res.json(true)
    }).catch(function(){
        res.json(false)
    })
}

exports.doesEmailExist = async function(req, res) {
    let emailBool = await User.doesEmailExist(req.body.email)
    res.json(emailBool)
}

exports.mustBeLoggedIn = function(req, res, next) {
    if(req.session.user) {
        next()
    } else {
        req.flash('errors', 'You must be logged in to access that page!')
        
        // Since the flash function updates session data in the databaase,
        // be sure to manually save the session before redirecting
        req.session.save(function(){
            res.redirect('/')
        })
    }
}

exports.apiMustBeLoggedIn = function(req, res, next) {
    console.log(req.body.token)
    try{
        req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET)
        next()
    } catch {
        res.json('Invalid token.')
    }
}

exports.login = function(req, res) {
    let user = new User(req.body)
    user.login().then(function(result){
        
        // Updating session data in the database
        req.session.user = {
            gravatar: user.gravatar,
            username: user.data.username,
            _id: user.data._id
        }

        //This function checks if the session data has been saved/updated
        req.session.save(function(){
            res.redirect('/')
        })
    }).catch(function(err){
        req.flash('errors', err)
        // the above function modifies the session data in the following manner:
        // req.session.flash.errors = [err]
        // and updates the db

        //This function checks if the session data has been saved/updated
        req.session.save(function(){
            res.redirect('/')
        })
    })
}

exports.apiLogin = function(req, res) {
    let user = new User(req.body)
    user.login().then(function(result) {
        res.json(jwt.sign({_id:user.data._id}, process.env.JWTSECRET, {expiresIn: "7d"}))
    }).catch(function(e) {
      res.send("Sorry, your values are not correct.")
    })
}

exports.logout = function(req, res) {
    req.session.destroy(function(){
        res.redirect('/')
    })
}

exports.register = function(req, res) {
    let user = new User(req.body)
    user.register().then(()=>{

        req.session.user = {
            username: user.data.username,
             gravatar: user.gravatar,
              _id:user.data._id
            }
        req.session.save(function(){
            res.redirect('/')
        })
    }).catch((regErrors)=>{
        regErrors.forEach(function(error){
            req.flash('regErrors', error)
        })
        req.session.save(function(){
            res.redirect('/')
        })
    })
}

exports.home = async function(req, res) {
    if (req.session.user) {
        // Fetch feed of posts for current user
        let posts = await Post.getFeed(req.session.user._id)
        res.render('home-dashboard', {posts: posts})
    } else {
        res.render('home-guest', {regErrors: req.flash('regErrors')})
        //flash('errors') automatically deletes the flash data from the db
    }
}

exports.ifUserExists = function(req, res, next) {
    User.findByUsername(req.params.username).then(function(userDoc){
        req.profileUser = userDoc
        next()
    }).catch(function(){
        res.render('404')
    })
}

exports.profilePostsScreen = function(req, res) {
    // Ask post model for posts by a certain author id
    Post.findByAuthorId(req.profileUser._id).then(function(posts){
        res.render('profile', {
            title: `Profile For ${req.profileUser.username}`,
            currentPage: 'posts',
            posts: posts,
            profileUsername: req.profileUser.username,
            profileGravatar: req.profileUser.gravatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            counts: {postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }
        })
    }).catch(function(){
        res.render('404')
    })
    
}

exports.sharedProfileData = async function(req, res, next) {
    let isVisitorsProfile = false
    let isFollowing = false
    if(req.session.user) {
        isVisitorsProfile = req.profileUser._id.equals(req.session.user._id)
        isFollowing = await Follow.isVisitorFollowing(req.profileUser._id, req.visitorId)
    }
    req.isVisitorsProfile = isVisitorsProfile
    req.isFollowing = isFollowing

    // Retrieve posts, followers and following counts
    let postCountPromise = Post.countPostsByAuthor(req.profileUser._id)
    let followerCountPromise = Follow.countFollowersById(req.profileUser._id)
    let followingCountPromise = Follow.countFollowingById(req.profileUser._id)
    let [postCount, followerCount, followingCount] = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise])
    
    req.postCount = postCount
    req.followerCount = followerCount
    req.followingCount = followingCount

    next()
}

exports.profileFollowersScreen = async function(req, res) {
    try{
        let followers = await Follow.getFollowersById(req.profileUser._id)
        res.render('profile-followers',  {
        currentPage: 'followers',
        followers: followers,
        profileUsername: req.profileUser.username,
        profileGravatar: req.profileUser.gravatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }
        })
    } catch {
        res.render('404')
    }
}

exports.profileFollowingScreen = async function(req, res) {
    try{
        let following = await Follow.getFollowingById(req.profileUser._id)
        res.render('profile-following',  {
        currentPage: 'following',
        following: following,
        profileUsername: req.profileUser.username,
        profileGravatar: req.profileUser.gravatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }
        })
    } catch {
        res.render('404')
    }
}