import passport from 'passport';
import passportLocal from 'passport-local';
import { Strategy as JWTstrategy, ExtractJwt as JWTExtract } from 'passport-jwt';
import Joi from 'joi';
import User from '../models/user';
import { loginSchema } from './validators';
import config from '../config';

const { secretOrKey } = config;

const LocalStrategy = passportLocal.Strategy;

export default ({ app }) => {
  /**
   * -------------- PASSPORT AUTHENTICATION ----------------
   */
  /**
   * Notice that these middlewares are initialized after the `express-session` middleware.  This is because
   * Passport relies on the `express-session` middleware and must have access to the `req.session` object.
   *
   * passport.initialize() - This creates middleware that runs before every HTTP request.  It works in two steps:
   *      1. Checks to see if the current session has a `req.session.passport` object on it.  This object will be
   *
   *          { user: '<Mongo DB user ID>' }
   *
   *      2.  If it finds a session with a `req.session.passport` property, it grabs the User ID and saves it to an
   *          internal Passport method for later.
   *
   * passport.session() - This calls the Passport Authenticator using the "Session Strategy".  Here are the basic
   * steps that this method takes:
   *      1.  Takes the MongoDB user ID obtained from the `passport.initialize()` method
   *          (run directly before) and passes
   *          it to the `passport.deserializeUser()` function (defined above in this module).
   *          The `passport.deserializeUser()` function will look up the User by the given ID in
   *          the database and return it.
   *      2.  If the `passport.deserializeUser()` returns a user object, this user object is assigned to the `req.user`
   *          property and can be accessed within the route.  If no user is returned, nothing happens and `next()`
   *          is called.
   */
  app.use(passport.initialize());
  app.use(passport.session());

  /**
   * This function is called when the `passport.authenticate()` method is called.
   *
   * If a user is found an validated, a callback is called (`cb(null, user)`) with the user
   * object.  The user object is then serialized with `passport.serializeUser()` and added to the
   * `req.session.passport` object.
   */

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        session: false,
        passReqToCallback: true, // this is the virtual field on the model
      },
      async (req, email, password, done) => {
        const { error } = Joi.validate(req.body, loginSchema);

        if (error) {
          return done(null, false, { message: error.details[0].message });
        }

        try {
          const user = await User.findOne({ email: email.trim() });
          if (!user) {
            return done(null, false, { message: 'Email does not exists.' });
          }

          user.comparePassword(password, (err, isMatch) => {
            if (err) {
              return done(err);
            }
            if (!isMatch) {
              return done(null, false, { message: 'Incorrect password.' });
            }

            return done(null, user);
          });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.use(
    new JWTstrategy(
      {
        jwtFromRequest: JWTExtract.fromAuthHeaderAsBearerToken(),
        secretOrKey,
      },
      async (payload, done) => {
        try {
          const user = await User.findById(payload.id);

          if (user) {
            done(null, user);
          } else {
            done(null, false);
          }
        } catch (err) {
          done(err, false);
        }
      },
    ),
  );

  passport.use(User.createStrategy());

  /**
   * This function is used in conjunction with the `passport.authenticate()` method.  See comments in
   * `passport.use()` above ^^ for explanation
   */
  passport.serializeUser(User.serializeUser());

  /**
   * This function is used in conjunction with the `app.use(passport.session())` middleware defined below.
   * Scroll down and read the comments in the PASSPORT AUTHENTICATION section to learn how this works.
   *
   * In summary, this method is "set" on the passport object and is passed the user ID stored in the
   * `req.session.passport` object later on.
   */
  passport.deserializeUser(User.deserializeUser());
};