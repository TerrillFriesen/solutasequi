const { describe, it, expect, fail } = global

const Client = require('../client')
const Report = require('../report')
const Session = require('../session')

const VALID_NOTIFIER = { name: 't', version: '0', url: 'http://' }

describe('@bugsnag/core/client', () => {
  describe('constructor', () => {
    it('can handle bad input', () => {
      expect(() => new Client()).toThrow()
      expect(() => new Client('foo')).toThrow()
    })
  })

  describe('configure()', () => {
    it('handles bad/good input', () => {
      const client = new Client(VALID_NOTIFIER)

      // no opts supplied
      expect(() => client.configure()).toThrow()
      try {
        client.configure()
      } catch (e) {
        expect(e.message).toMatch(/^Bugsnag configuration error/)
      }

      // bare minimum opts supplied
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      expect(() => client.configure()).toBeDefined()
    })
  })

  describe('use()', () => {
    it('supports plugins', done => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: '123' })
      client.configure()
      client.use({
        name: 'test plugin',
        description: 'nothing much to see here',
        init: (c) => {
          expect(c).toEqual(client)
          done()
        }
      })
    })
  })

  describe('logger()', () => {
    it('can supply a different logger', done => {
      const client = new Client(VALID_NOTIFIER)
      const log = (msg) => {
        expect(msg).toBeTruthy()
        done()
      }
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.logger({ debug: log, info: log, warn: log, error: log })
      client._logger.debug('hey')
    })
    it('can supply a different logger via config', done => {
      const client = new Client(VALID_NOTIFIER)
      const log = (msg) => {
        expect(msg).toBeTruthy()
        done()
      }
      client.setOptions({
        apiKey: 'API_KEY_YEAH',
        logger: {
          debug: log,
          info: log,
          warn: log,
          error: log
        }
      })
      client.configure()
      client._logger.debug('hey')
    })
    it('is ok with a null logger', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({
        apiKey: 'API_KEY_YEAH',
        logger: null
      })
      client.configure()
      client._logger.debug('hey')
    })
  })

  describe('notify()', () => {
    it('throws if called before configure()', () => {
      const client = new Client(VALID_NOTIFIER)
      expect(() => client.notify()).toThrow()
    })

    it('delivers an error report', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: payload => {
          expect(payload).toBeTruthy()
          expect(Array.isArray(payload.events)).toBe(true)
          const report = payload.events[0].toJSON()
          expect(report.severity).toBe('warning')
          expect(report.severityReason).toEqual({ type: 'handledException' })
          process.nextTick(() => done())
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.notify(new Error('oh em gee'))
    })

    it('supports manually setting severity', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          expect(payload).toBeTruthy()
          expect(Array.isArray(payload.events)).toBe(true)
          const report = payload.events[0].toJSON()
          expect(report.severity).toBe('error')
          expect(report.severityReason).toEqual({ type: 'userSpecifiedSeverity' })
          done()
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.notify(new Error('oh em gee'), { severity: 'error' })
    })

    it('supports setting severity via callback', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          expect(payload).toBeTruthy()
          expect(Array.isArray(payload.events)).toBe(true)
          const report = payload.events[0].toJSON()
          expect(report.severity).toBe('info')
          expect(report.severityReason).toEqual({ type: 'userCallbackSetSeverity' })
          done()
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.notify(new Error('oh em gee'), {
        beforeSend: report => {
          report.severity = 'info'
        }
      })
    })

    it('supports preventing send with report.ignore() / return false', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          fail('sendReport() should not be called')
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()

      client.notify(new Error('oh em gee'), { beforeSend: report => report.ignore() })
      client.notify(new Error('oh em eff gee'), { beforeSend: report => false })

      // give the event loop a tick to see if the reports get send
      process.nextTick(() => done())
    })

    it('supports preventing send with notifyReleaseStages', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          fail('sendReport() should not be called')
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', notifyReleaseStages: [] })
      client.configure()

      client.notify(new Error('oh em eff gee'))

      // give the event loop a tick to see if the reports get send
      process.nextTick(() => done())
    })

    it('supports setting releaseStage via config.releaseStage', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          fail('sendReport() should not be called')
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', releaseStage: 'staging', notifyReleaseStages: [ 'production' ] })
      client.configure()

      client.notify(new Error('oh em eff gee'))

      // give the event loop a tick to see if the reports get send
      process.nextTick(() => done())
    })

    it('supports setting releaseStage via client.app.releaseStage', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          fail('sendReport() should not be called')
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', notifyReleaseStages: [ 'production' ] })
      client.configure()
      client.app.releaseStage = 'staging'

      client.notify(new Error('oh em eff gee'))

      // give the event loop a tick to see if the reports get send
      process.nextTick(() => done())
    })

    it('includes releaseStage in report.app', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          expect(payload.events[0].app.releaseStage).toBe('staging')
          done()
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', notifyReleaseStages: [ 'staging' ] })
      client.configure()
      client.app.releaseStage = 'staging'
      client.notify(new Error('oh em eff gee'))
    })

    it('includes releaseStage in report.app when set via config', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          expect(payload.events[0].app.releaseStage).toBe('staging')
          done()
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', notifyReleaseStages: [ 'staging' ], releaseStage: 'staging' })
      client.configure()
      client.notify(new Error('oh em eff gee'))
    })

    it('prefers client.app.releaseStage over config.releaseStage', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          expect(payload.events[0].app.releaseStage).toBe('testing')
          done()
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', notifyReleaseStages: [ 'testing' ], releaseStage: 'staging' })
      client.configure()
      client.app.releaseStage = 'testing'
      client.notify(new Error('oh em eff gee'))
    })

    it('populates client.app.version if config.appVersion is supplied', done => {
      const client = new Client(VALID_NOTIFIER)
      client.delivery(client => ({
        sendReport: (payload) => {
          expect(payload.events[0].app.version).toBe('1.2.3')
          done()
        }
      }))
      client.setOptions({ apiKey: 'API_KEY_YEAH', appVersion: '1.2.3' })
      client.configure()
      client.notify(new Error('oh em eff gee'))
    })

    it('can handle all kinds of bad input', () => {
      const payloads = []
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.delivery(client => ({ sendReport: (payload) => payloads.push(payload) }))

      client.notify(undefined)
      client.notify(null)
      client.notify(() => {})
      client.notify({ name: 'some message' })
      client.notify(1)
      client.notify('errrororor')
      client.notify('str1', 'str2')
      client.notify('str1', null)

      expect(payloads[0].events[0].toJSON().exceptions[0].message).toBe('Bugsnag usage error. notify() expected error/opts parameters, got nothing')
      expect(payloads[1].events[0].toJSON().exceptions[0].message).toBe('Bugsnag usage error. notify() expected error/opts parameters, got null')
      expect(payloads[2].events[0].toJSON().exceptions[0].message).toBe('Bugsnag usage error. notify() expected error/opts parameters, got function')
      expect(payloads[3].events[0].toJSON().exceptions[0].message).toBe('Bugsnag usage error. notify() expected error/opts parameters, got unsupported object')
      expect(payloads[4].events[0].toJSON().exceptions[0].message).toBe('1')
      expect(payloads[5].events[0].toJSON().exceptions[0].message).toBe('errrororor')
      expect(payloads[6].events[0].toJSON().metaData).toEqual({ notifier: { notifyArgs: [ 'str1', 'str2' ] } })
      expect(payloads[7].events[0].toJSON().exceptions[0].message).toBe('str1')
      expect(payloads[7].events[0].toJSON().metaData).toEqual({})
    })

    it('supports { name, message } usage', () => {
      const payloads = []
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.delivery(client => ({ sendReport: (payload) => payloads.push(payload) }))
      client.notify({ name: 'UnknownThing', message: 'found a thing that couldn’t be dealt with' })

      expect(payloads.length).toBe(1)
      expect(payloads[0].events[0].toJSON().exceptions[0].errorClass).toBe('UnknownThing')
      expect(payloads[0].events[0].toJSON().exceptions[0].message).toBe('found a thing that couldn’t be dealt with')
      expect(payloads[0].events[0].toJSON().exceptions[0].stacktrace[0].method).not.toMatch(/BugsnagClient/)
      expect(payloads[0].events[0].toJSON().exceptions[0].stacktrace[0].file).not.toMatch(/core\/client\.js/)
    })

    it('leaves a breadcrumb of the error', () => {
      const payloads = []
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.delivery(client => ({ sendReport: (payload) => payloads.push(payload) }))
      client.notify(new Error('foobar'))
      expect(client.breadcrumbs.length).toBe(1)
      expect(client.breadcrumbs[0].type).toBe('error')
      expect(client.breadcrumbs[0].name).toBe('Error')
      expect(client.breadcrumbs[0].metaData.stacktrace).toBe(undefined)
      // the error shouldn't appear as a breadcrumb for itself
      expect(payloads[0].events[0].breadcrumbs.length).toBe(0)
    })

    it('doesn’t modify global client.metaData when using updateMetaData() method', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.metaData = { foo: [ 1, 2, 3 ] }
      client.notify(new Error('changes afoot'), {
        beforeSend: (report) => {
          report.updateMetaData('foo', '3', 1)
        }
      })
      expect(client.metaData.foo['3']).toBe(undefined)
    })

    it('should call the callback (success)', done => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY' })
      client.configure()
      client.delivery(client => ({
        sendSession: () => {},
        sendReport: (report, cb) => cb(null)
      }))
      client.notify(new Error('111'), {}, (err, report) => {
        expect(err).toBe(null)
        expect(report).toBeTruthy()
        expect(report.errorMessage).toBe('111')
        done()
      })
    })

    it('should call the callback (err)', done => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY' })
      client.configure()
      client.delivery(client => ({
        sendSession: () => {},
        sendReport: (report, cb) => cb(new Error('flerp'))
      }))
      client.notify(new Error('111'), {}, (err, report) => {
        expect(err).toBeTruthy()
        expect(err.message).toBe('flerp')
        expect(report).toBeTruthy()
        expect(report.errorMessage).toBe('111')
        done()
      })
    })

    it('should call the callback even if the report doesn’t send (notifyReleaseStages)', done => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY', notifyReleaseStages: [ 'production' ], releaseStage: 'development' })
      client.configure()
      client.delivery(client => ({
        sendSession: () => {},
        sendReport: (report, cb) => cb(null)
      }))
      client.notify(new Error('111'), {}, (err, report) => {
        expect(err).toBe(null)
        expect(report).toBeTruthy()
        expect(report.errorMessage).toBe('111')
        done()
      })
    })

    it('should call the callback even if the report doesn’t send (beforeSend)', done => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY', beforeSend: () => false })
      client.configure()
      client.delivery(client => ({
        sendSession: () => {},
        sendReport: (report, cb) => cb(null)
      }))
      client.notify(new Error('111'), {}, (err, report) => {
        expect(err).toBe(null)
        expect(report).toBeTruthy()
        expect(report.errorMessage).toBe('111')
        done()
      })
    })

    it('should attach the original error to the report object', done => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY', beforeSend: () => false })
      client.configure()
      client.delivery(client => ({
        sendSession: () => {},
        sendReport: (report, cb) => cb(null)
      }))
      const orig = new Error('111')
      client.notify(orig, {}, (err, report) => {
        expect(err).toBe(null)
        expect(report).toBeTruthy()
        expect(report.originalError).toBe(orig)
        done()
      })
    })
  })

  describe('leaveBreadcrumb()', () => {
    it('creates a manual breadcrumb when a list of arguments are supplied', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.leaveBreadcrumb('french stick')
      expect(client.breadcrumbs.length).toBe(1)
      expect(client.breadcrumbs[0].type).toBe('manual')
      expect(client.breadcrumbs[0].name).toBe('french stick')
      expect(client.breadcrumbs[0].metaData).toEqual({})
    })

    it('caps the length of breadcrumbs at the configured limit', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH', maxBreadcrumbs: 3 })
      client.configure()
      client.leaveBreadcrumb('malted rye')
      expect(client.breadcrumbs.length).toBe(1)
      client.leaveBreadcrumb('medium sliced white hovis')
      expect(client.breadcrumbs.length).toBe(2)
      client.leaveBreadcrumb('pumperninkel')
      expect(client.breadcrumbs.length).toBe(3)
      client.leaveBreadcrumb('seedy farmhouse')
      expect(client.breadcrumbs.length).toBe(3)
      expect(client.breadcrumbs.map(b => b.name)).toEqual([
        'medium sliced white hovis',
        'pumperninkel',
        'seedy farmhouse'
      ])
    })

    it('doesn’t add the breadcrumb if it didn’t contain anything useful', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH' })
      client.configure()
      client.leaveBreadcrumb(undefined)
      client.leaveBreadcrumb(null, { data: 'is useful' })
      client.leaveBreadcrumb(null, {}, null)
      client.leaveBreadcrumb(null, { t: 10 }, null, 4)
      expect(client.breadcrumbs.length).toBe(3)
      expect(client.breadcrumbs[0].type).toBe('manual')
      expect(client.breadcrumbs[0].name).toBe('[anonymous]')
      expect(client.breadcrumbs[0].metaData).toEqual({ data: 'is useful' })
      expect(client.breadcrumbs[1].type).toBe('manual')
      expect(typeof client.breadcrumbs[2].timestamp).toBe('string')
    })

    it('allows maxBreadcrumbs to be set to 0', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY_YEAH', maxBreadcrumbs: 0 })
      client.configure()
      client.leaveBreadcrumb('toast')
      expect(client.breadcrumbs.length).toBe(0)
      client.leaveBreadcrumb('toast')
      client.leaveBreadcrumb('toast')
      client.leaveBreadcrumb('toast')
      client.leaveBreadcrumb('toast')
      expect(client.breadcrumbs.length).toBe(0)
    })
  })

  describe('startSession()', () => {
    it('calls the provided the session delegate and return delegate’s return value', () => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY' })
      let ret
      client.configure()
      client.sessionDelegate({
        startSession: c => {
          expect(c).toBe(client)
          ret = {}
          return ret
        }
      })
      expect(client.startSession()).toBe(ret)
    })

    it('calls warns if a session delegate is not provided', (done) => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY' })
      client.configure()
      client.logger({
        debug: () => {},
        info: () => {},
        warn: (...args) => {
          expect(args[0]).toMatch(/^No session/)
          done()
        },
        error: () => {}
      })
      client.startSession()
    })

    it('tracks error counts using the session delegate and sends them in error payloads', (done) => {
      const client = new Client(VALID_NOTIFIER)
      client.setOptions({ apiKey: 'API_KEY' })
      client.configure()
      let i = 0
      client.sessionDelegate({
        startSession: (client) => {
          client._session = new Session()
          return client
        }
      })
      client.delivery(client => ({
        sendSession: () => {},
        sendReport: (report, cb) => {
          if (++i < 10) return
          const r = JSON.parse(JSON.stringify(report.events[0]))
          expect(r.session).toBeDefined()
          expect(r.session.events.handled).toBe(6)
          expect(r.session.events.unhandled).toBe(4)
          done()
        }
      }))
      const sessionClient = client.startSession()
      sessionClient.notify(new Error('broke'))
      sessionClient.notify(new Report('err', 'bad', [], { unhandled: true, severity: 'error', severityReason: { type: 'unhandledException' } }))
      sessionClient.notify(new Error('broke'))
      sessionClient.notify(new Error('broke'))
      sessionClient.notify(new Report('err', 'bad', [], { unhandled: true, severity: 'error', severityReason: { type: 'unhandledException' } }))
      sessionClient.notify(new Error('broke'))
      sessionClient.notify(new Error('broke'))
      sessionClient.notify(new Error('broke'))
      sessionClient.notify(new Report('err', 'bad', [], { unhandled: true, severity: 'error', severityReason: { type: 'unhandledException' } }))
      sessionClient.notify(new Report('err', 'bad', [], { unhandled: true, severity: 'error', severityReason: { type: 'unhandledException' } }))
    })
  })
})
